import { cn } from "@/lib/utils"

export function ChipButton({
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
        "flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-start transition-colors",
        selected ? "border-foreground bg-foreground/5" : "border-foreground/15"
      )}
    >
      <span className="text-sm font-medium">{label}</span>
      {description && (
        <span className="text-[10px] text-muted-foreground">{description}</span>
      )}
    </button>
  )
}
