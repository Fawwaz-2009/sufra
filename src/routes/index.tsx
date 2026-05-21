import { useRef, type ChangeEvent } from "react"
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { createFileRoute, Link, redirect } from "@tanstack/react-router"
import { CaretLeft, CaretRight, Camera } from "@phosphor-icons/react"

import { z } from "zod"

import { BottomNav } from "@/components/bottom-nav"
import { DaySummaryPanel } from "@/components/day-summary-panel"
import { MealCard, type MealCardData } from "@/components/meal-card"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { snapshotFor } from "../../worker/profile/derive"
import {
  addDays,
  diffInLocalDays,
  formatLocalDate,
  isSameLocalDay,
  localDateForCapture,
  parseLocalDate,
  selectedDayLabel,
  todayLocal,
  weekDays,
  weekRange,
  weekStart,
} from "@/lib/date"
import { cn } from "@/lib/utils"

const indexSearchSchema = z.object({
  date: z.iso
    .date()
    .refine(
      (s) => diffInLocalDays(parseLocalDate(s), todayLocal()) <= 0,
      "future_date"
    )
    .optional()
    .catch(undefined),
})

type IndexSearch = z.infer<typeof indexSearchSchema>

function resolveSelectedDay(search: IndexSearch): Date {
  return search.date ? parseLocalDate(search.date) : todayLocal()
}

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

  const today = todayLocal()
  const selectedDay = resolveSelectedDay(search)

  const ws = weekStart(selectedDay)
  const { data, isLoading } = useQuery(weekMealsQueryOptions(ws))

  const allMeals = (data?.meals ?? []) as MealCardData[]
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

      <main className="flex-1 px-5 pb-40">
        <section>
          <h2 className="mt-6 mb-3 text-xs font-medium tracking-wider text-muted-foreground uppercase">
            Meals
          </h2>
          {isLoading ? (
            <MealsSkeleton />
          ) : mealsForSelectedDay.length === 0 ? (
            <EmptyState isToday={isViewingToday} />
          ) : (
            <ul className="flex flex-col gap-3">
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

      <CaptureFab
        disabled={uploadMutation.isPending}
        label={uploadMutation.isPending ? "Uploading…" : "Log a meal"}
        onClick={() => fileInputRef.current?.click()}
      />
      <BottomNav />
    </DayShell>
  )
}

function weekMealsQueryOptions(weekStartDate: Date) {
  return queryOptions({
    queryKey: ["meals", "week", formatLocalDate(weekStartDate)] as const,
    queryFn: async () => {
      const { from, to } = weekRange(weekStartDate)
      const res = await api.api.meals.$get({ query: { from, to } })
      if (!res.ok) throw new Error("failed_to_load_meals")
      const json = await res.json()
      if ("error" in json) throw new Error(json.error)
      return json
    },
  })
}

function DayShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col bg-background">
      {children}
    </div>
  )
}

function DayHeader({
  label,
  onPrev,
  onNext,
  canGoNext,
}: {
  label: string
  onPrev: () => void
  onNext: () => void
  canGoNext: boolean
}) {
  return (
    <header className="flex items-center justify-between gap-2 px-3 pt-4 pb-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={onPrev}
        aria-label="Previous week"
      >
        <CaretLeft className="size-5" weight="bold" />
      </Button>
      <h1 className="font-heading text-base font-semibold">{label}</h1>
      <Button
        variant="ghost"
        size="icon"
        onClick={onNext}
        disabled={!canGoNext}
        aria-label="Next week"
      >
        <CaretRight className="size-5" weight="bold" />
      </Button>
    </header>
  )
}

const WEEKDAY_INITIALS = ["M", "T", "W", "T", "F", "S", "S"]

function DayStrip({
  weekStartDate,
  selectedDay,
  today,
  onSelect,
}: {
  weekStartDate: Date
  selectedDay: Date
  today: Date
  onSelect: (d: Date) => void
}) {
  const days = weekDays(weekStartDate)
  return (
    <div className="grid grid-cols-7 gap-1 px-3 pb-2">
      {days.map((d, i) => {
        const isFuture = diffInLocalDays(d, today) > 0
        const isSelected = isSameLocalDay(d, selectedDay)
        return (
          <button
            key={d.toISOString()}
            type="button"
            disabled={isFuture}
            onClick={() => onSelect(d)}
            className="flex flex-col items-center gap-1 py-1 disabled:cursor-not-allowed"
            aria-pressed={isSelected}
          >
            <span
              className={cn(
                "text-[10px] font-medium tracking-wider uppercase",
                isFuture ? "text-muted-foreground/40" : "text-muted-foreground"
              )}
            >
              {WEEKDAY_INITIALS[i]}
            </span>
            <span
              className={cn(
                "flex size-9 items-center justify-center rounded-full text-sm font-medium tabular-nums",
                isSelected && "bg-foreground text-background",
                !isSelected && isFuture && "text-muted-foreground/40",
                !isSelected && !isFuture && "ring-1 ring-foreground/15"
              )}
            >
              {d.getDate()}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function CaptureFab({
  disabled,
  label,
  onClick,
}: {
  disabled: boolean
  label: string
  onClick: () => void
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-16 z-10 mx-auto flex max-w-md justify-center bg-linear-to-t from-background via-background/80 to-transparent px-5 pt-8 pb-2">
      <Button
        size="lg"
        disabled={disabled}
        className="pointer-events-auto h-14 w-full max-w-xs gap-2 rounded-full text-base shadow-lg"
        onClick={onClick}
      >
        <Camera weight="bold" className="size-5" />
        {label}
      </Button>
    </div>
  )
}

function EmptyState({ isToday }: { isToday: boolean }) {
  if (isToday) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl bg-card px-6 py-12 text-center ring-1 ring-foreground/10">
        <p className="font-medium">No meals logged yet</p>
        <p className="text-sm text-muted-foreground">
          Tap <span className="font-medium">Log a meal</span> to photograph your
          first one.
        </p>
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl bg-card px-6 py-12 text-center ring-1 ring-foreground/10">
      <p className="font-medium">No meals logged this day.</p>
    </div>
  )
}

function MealsSkeleton() {
  return (
    <ul className="flex flex-col gap-3">
      {[0, 1, 2].map((i) => (
        <li
          key={i}
          className="flex items-center gap-4 rounded-xl bg-card p-3 ring-1 ring-foreground/10"
        >
          <div className="size-20 shrink-0 animate-pulse rounded-lg bg-muted" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-6 w-1/3 animate-pulse rounded bg-muted" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
          </div>
        </li>
      ))}
    </ul>
  )
}

function DayViewPending() {
  return (
    <DayShell>
      <header className="flex items-center justify-between gap-2 px-3 pt-4 pb-1">
        <div className="size-9 animate-pulse rounded-md bg-muted" />
        <div className="h-5 w-28 animate-pulse rounded bg-muted" />
        <div className="flex items-center gap-0.5">
          <div className="size-9 animate-pulse rounded-md bg-muted" />
          <div className="size-9 animate-pulse rounded-md bg-muted" />
        </div>
      </header>
      <div className="grid grid-cols-7 gap-1 px-3 pb-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-1 py-1">
            <div className="h-2.5 w-3 animate-pulse rounded bg-muted" />
            <div className="size-9 animate-pulse rounded-full bg-muted" />
          </div>
        ))}
      </div>
      <main className="flex-1 px-5 pb-40">
        <h2 className="mt-6 mb-3 text-xs font-medium tracking-wider text-muted-foreground uppercase">
          Meals
        </h2>
        <MealsSkeleton />
      </main>
    </DayShell>
  )
}

function DayViewError({ error }: { error: Error }) {
  return (
    <DayShell>
      <div className="flex flex-1 flex-col items-center justify-center px-5 text-center">
        <p className="font-medium">Couldn't load your day.</p>
        <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
      </div>
    </DayShell>
  )
}
