import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cmToImperial, imperialToCm } from "@/lib/units"
import { StepHeading } from "./step-heading"
import { UnitToggle } from "./unit-toggle"

export function StepHeight({
  heightCm,
  unit,
  onHeightChange,
  onUnitChange,
}: {
  heightCm: number | null
  unit: "cm" | "imperial"
  onHeightChange: (cm: number) => void
  onUnitChange: (u: "cm" | "imperial") => void
}) {
  return (
    <div className="flex flex-col gap-6">
      <StepHeading title="How tall are you?" />
      <UnitToggle
        value={unit}
        options={[
          { value: "cm", label: "cm" },
          { value: "imperial", label: "ft + in" },
        ]}
        onChange={onUnitChange}
      />
      {unit === "cm" ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="height-cm">Height (cm)</Label>
          <Input
            id="height-cm"
            type="number"
            inputMode="numeric"
            min={100}
            max={250}
            value={heightCm ?? ""}
            onChange={(e) => {
              const v = e.target.value
              if (v === "") return
              const n = Number(v)
              if (Number.isFinite(n)) onHeightChange(Math.round(n))
            }}
          />
        </div>
      ) : (
        <ImperialHeightInput
          heightCm={heightCm}
          onChange={onHeightChange}
        />
      )}
    </div>
  )
}

function ImperialHeightInput({
  heightCm,
  onChange,
}: {
  heightCm: number | null
  onChange: (cm: number) => void
}) {
  const display =
    heightCm != null ? cmToImperial(heightCm) : { feet: 0, inches: 0 }
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="height-ft">Feet</Label>
        <Input
          id="height-ft"
          type="number"
          inputMode="numeric"
          min={3}
          max={8}
          value={heightCm != null ? display.feet : ""}
          onChange={(e) => {
            const n = Number(e.target.value)
            if (Number.isFinite(n)) onChange(imperialToCm(n, display.inches))
          }}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="height-in">Inches</Label>
        <Input
          id="height-in"
          type="number"
          inputMode="numeric"
          min={0}
          max={11}
          value={heightCm != null ? display.inches : ""}
          onChange={(e) => {
            const n = Number(e.target.value)
            if (Number.isFinite(n)) onChange(imperialToCm(display.feet, n))
          }}
        />
      </div>
    </div>
  )
}
