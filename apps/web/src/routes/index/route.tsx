import { useRef, useState, type ChangeEvent } from "react"
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { createFileRoute, Link, redirect } from "@tanstack/react-router"
import { toast } from "sonner"

import { BottomNav } from "@/components/bottom-nav"
import { DaySummaryPanel } from "@/components/day-summary-panel"
import { MealCard } from "@/components/meal-card"
import { useAuth } from "@/lib/auth-context"
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
import { snapshotFor } from "../../../worker/profile/isomorphic/derive"
import type { MealListItem } from "../../../worker/meals/schema"
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
  beforeLoad: ({ context }) => {
    if (!context.session) throw redirect({ to: "/login" })
    return { session: context.session }
  },
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
  const auth = useAuth()
  const queryClient = useQueryClient()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [savedSheetOpen, setSavedSheetOpen] = useState(false)

  const today = todayLocal()
  const selectedDay = resolveSelectedDay(search)

  const ws = weekStart(selectedDay)
  const { data, isLoading } = useQuery(weekMealsQueryOptions(ws))

  const allMeals = (data?.meals ?? []) as MealListItem[]
  const mealsForSelectedDay = allMeals.filter((m) =>
    isSameLocalDay(new Date(m.capturedAt), selectedDay)
  )

  // Past-day-aware profile lookup: each day reads the snapshot that was
  // active for it. See ADR 0002.
  const profileForDay = snapshotFor(
    auth.profiles,
    formatLocalDate(selectedDay)
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

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append("photo", file)
      if (!isViewingToday) {
        formData.append("capturedAt", localDateForCapture(selectedDay))
      }
      const res = await fetch("/api/meals", { method: "POST", body: formData })
      if (!res.ok) {
        const body = (await res
          .json<{ error?: string }>()
          .catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? "upload_failed")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meals"] })
    },
    // Surface failures with a clear toast instead of silently reverting the
    // button. Server returns the error code (see worker/errors.ts ERROR_CODES);
    // map known codes to readable copy. Anything we don't recognize falls
    // through to a generic message — the user can retry.
    onError: (error: Error) => {
      toast.error(captureErrorMessage(error.message))
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

      {profileForDay && (
        <DaySummaryPanel
          meals={mealsForSelectedDay}
          profile={profileForDay}
        />
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
        capturedAt={
          isViewingToday ? undefined : localDateForCapture(selectedDay)
        }
      />
      <BottomNav />
    </DayShell>
  )
}

// Map server error codes (worker/errors.ts ERROR_CODES) to user-readable
// copy for the capture toast. Keep messages calm and short — they appear
// at top-center where they compete with the Day view for attention.
function captureErrorMessage(code: string): string {
  switch (code) {
    case "photo_too_large":
      return "Photo is too big. Try a smaller one."
    case "captured_at_in_future":
      return "Can't log a meal in the future."
    case "too_many_requests":
      return "You've reached today's AI limit. Try again tomorrow."
    case "unauthorized":
      return "Signed out — sign in again to continue."
    case "photo_missing":
      return "Couldn't read the photo. Try again."
    default:
      return "Couldn't save that meal. Try again in a moment."
  }
}
