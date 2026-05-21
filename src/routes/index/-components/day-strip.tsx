import { diffInLocalDays, isSameLocalDay, weekDays } from "@/lib/date"
import { cn } from "@/lib/utils"

const WEEKDAY_INITIALS = ["M", "T", "W", "T", "F", "S", "S"]

export function DayStrip({
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
                isFuture
                  ? "text-muted-foreground/40"
                  : "text-muted-foreground"
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
