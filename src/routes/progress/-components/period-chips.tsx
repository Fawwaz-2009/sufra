import { cn } from "@/lib/utils"

// Period selector strip. Same shape for the Weight card (1M/3M/6M/1Y) and
// the Calories card (7D/30D/90D/1Y); the parent passes the right options.

export function PeriodChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={cn(
            "rounded-md border px-3 py-2 text-xs font-medium transition-colors",
            o === value
              ? "border-foreground/40 bg-background text-foreground"
              : "border-foreground/10 bg-card text-muted-foreground hover:text-foreground"
          )}
        >
          {o}
        </button>
      ))}
    </div>
  )
}
