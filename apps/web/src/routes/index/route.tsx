import { useRef, useState, type ChangeEvent } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { toast } from "sonner"

import { MealCard } from "@/components/meal-card"
import { DaySummaryPanel } from "@/components/day-summary-panel"
import { getClient, run } from "@/client/api-client"
import { requireOnboarded } from "@/client/gate"
import { meQueryOptions } from "@/client/me"
import { snapshotFor } from "@/worker/views/derive"
import {
  addDays,
  diffInLocalDays,
  formatLocalDate,
  isSameLocalDay,
  localDateForCapture,
  parseLocalDate,
  selectedDayLabel,
  todayLocal,
  weekStart,
} from "@/lib/date"
import { AddMealRow } from "./-components/add-meal-row"
import { DayHeader } from "./-components/day-header"
import { DayShell } from "./-components/day-shell"
import { DayStrip } from "./-components/day-strip"
import { EmptyState } from "./-components/empty-state"
import { DayViewError } from "./-components/error"
import { MealsSkeleton } from "./-components/meals-skeleton"
import { DayViewPending } from "./-components/pending"
import { SavedMealsSheet } from "./-components/saved-meals-sheet"
import { weekMealsQueryOptions } from "./-queries"
import { indexSearchSchema, resolveSelectedDay } from "./-search"

export const Route = createFileRoute("/")({
  validateSearch: (search) => indexSearchSchema.parse(search),
  loaderDeps: ({ search }) => ({
    weekKey: formatLocalDate(weekStart(resolveSelectedDay(search))),
  }),
  beforeLoad: ({ context }) => requireOnboarded(context.queryClient),
  loader: ({ context, deps }) => {
    return context.queryClient.ensureQueryData(
      weekMealsQueryOptions(parseLocalDate(deps.weekKey))
    )
  },
  pendingComponent: DayViewPending,
  errorComponent: DayViewError,
  component: Home,
})

function Home() {
  const queryClient = useQueryClient()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [savedSheetOpen, setSavedSheetOpen] = useState(false)

  const today = todayLocal()
  const selectedDay = resolveSelectedDay(search)

  const ws = weekStart(selectedDay)
  const { data, isLoading } = useQuery(weekMealsQueryOptions(ws))
  // The profile snapshot active on the SELECTED day drives the Day Summary's Target/macros — past days
  // read their historical snapshot (ADR 0002/0003). The onboarding gate guarantees `/me` is cached.
  const me = useQuery(meQueryOptions()).data
  const daySnapshot = me ? snapshotFor(me.profiles, formatLocalDate(selectedDay)) : null

  const allMeals = data ?? []
  const mealsForSelectedDay = allMeals.filter((m) =>
    isSameLocalDay(new Date(m.capturedAt), selectedDay)
  )

  const isViewingToday = isSameLocalDay(selectedDay, today)
  const canGoNext = diffInLocalDays(selectedDay, today) < 0

  const selectDay = (d: Date) =>
    navigate({
      search: isSameLocalDay(d, today) ? {} : { date: formatLocalDate(d) },
      replace: true,
    })
  const goPrevWeek = () => selectDay(addDays(selectedDay, -7))
  const goNextWeek = () => {
    const next = addDays(selectedDay, 7)
    selectDay(diffInLocalDays(next, today) > 0 ? today : next)
  }

  // Photo capture → the typed `create` (base64 Upload, no multipart). The estimator gates persistence;
  // a failure surfaces the server's human message (EstimateFailed / UnsupportedMedia / MediaTooLarge).
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const capturedAt = isViewingToday ? undefined : localDateForCapture(selectedDay)
      return run(
        (await getClient()).meals.create({
          payload: { photo: { filename: file.name, data: bytes }, ...(capturedAt ? { capturedAt } : {}) },
        })
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meals"] })
    },
    onError: (error: unknown) => {
      toast.error(captureErrorMessage(error))
    },
  })

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    uploadMutation.mutate(file)
    e.target.value = ""
  }

  return (
    <DayShell>
      <DayHeader
        label={selectedDayLabel(selectedDay, today)}
        onPrev={goPrevWeek}
        onNext={goNextWeek}
        canGoNext={canGoNext}
      />
      <DayStrip
        weekStartDate={ws}
        selectedDay={selectedDay}
        today={today}
        onSelect={selectDay}
      />

      {daySnapshot && (
        <div className="mt-4">
          <DaySummaryPanel meals={mealsForSelectedDay} profile={daySnapshot} />
        </div>
      )}

      <main className="flex-1 px-5 pb-24">
        <section>
          <h2 className="mt-6 mb-3 text-xs font-medium tracking-wider text-muted-foreground uppercase">
            Meals
          </h2>
          <AddMealRow
            uploading={uploadMutation.isPending}
            onTakePhoto={() => fileInputRef.current?.click()}
            onPickSaved={() => setSavedSheetOpen(true)}
          />
          {isLoading ? (
            <div className="mt-3">
              <MealsSkeleton />
            </div>
          ) : mealsForSelectedDay.length === 0 ? (
            <div className="mt-3">
              <EmptyState isToday={isViewingToday} />
            </div>
          ) : (
            <ul className="mt-3 flex flex-col gap-3">
              {mealsForSelectedDay.map((meal) => (
                <li key={meal.id}>
                  <Link
                    to="/meals/$id"
                    params={{ id: meal.id }}
                    className="block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <MealCard meal={meal} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {uploadMutation.isError && (
            <p className="mt-3 text-sm text-destructive">
              Couldn't upload that photo. Try again.
            </p>
          )}
        </section>
      </main>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      <SavedMealsSheet
        open={savedSheetOpen}
        onOpenChange={setSavedSheetOpen}
        capturedAt={isViewingToday ? undefined : localDateForCapture(selectedDay)}
      />
    </DayShell>
  )
}

// The estimator surfaces user-facing failures as TYPED errors carrying a human `message`; show it
// verbatim with a calm generic fallback. (No client-side policy strings — the server owns the copy.)
function captureErrorMessage(error: unknown): string {
  const msg = (error as { message?: unknown })?.message
  return typeof msg === "string" && msg.length > 0
    ? msg
    : "Couldn't save that meal. Try again in a moment."
}
