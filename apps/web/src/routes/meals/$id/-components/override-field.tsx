import { X } from "@phosphor-icons/react"

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
  const edited = value.trim() !== ""
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className="text-xs">
          {label}
        </Label>
        {edited && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label={`Clear ${label} override`}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider transition-colors"
          >
            <X className="size-2.5" weight="bold" />
            edited
          </button>
        )}
      </div>
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
    </div>
  )
}
