import { DayShell } from "./day-shell"
import { MealsSkeleton } from "./meals-skeleton"

export function DayViewPending() {
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
