import { cn } from "@/lib/utils"

export function ChoiceChip({
  label,
  description,
  selected,
  onClick,
}: {
  label: string
  description?: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex flex-col items-start gap-0.5 rounded-xl border px-4 py-3 text-start transition-colors",
        selected
          ? "border-foreground bg-foreground/5"
          : "border-foreground/15 hover:border-foreground/30"
      )}
    >
      <span className="font-medium">{label}</span>
      {description && (
        <span className="text-xs text-muted-foreground">{description}</span>
      )}
    </button>
  )
}
