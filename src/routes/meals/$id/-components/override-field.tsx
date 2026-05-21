import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function OverrideField({
  label,
  unit,
  value,
  aiValue,
  onChange,
}: {
  label: string
  unit: string
  value: string
  aiValue: number
  onChange: (v: string) => void
}) {
  const id = `field-${label.toLowerCase()}`
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={String(Math.round(aiValue))}
          className="pr-10 tabular-nums"
        />
        <span className="text-muted-foreground pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs">
          {unit}
        </span>
      </div>
      <p className="text-muted-foreground text-[10px]">
        AI: {Math.round(aiValue)} {unit}
      </p>
    </div>
  )
}
