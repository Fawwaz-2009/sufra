import { useState } from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { kgToLb, lbToKg } from "@/lib/units"
import { StepHeading } from "./step-heading"
import { UnitToggle } from "./unit-toggle"

export function StepWeight({
  weightKg,
  unit,
  onWeightChange,
  onUnitChange,
}: {
  weightKg: number | null
  unit: "kg" | "lb"
  onWeightChange: (kg: number) => void
  onUnitChange: (u: "kg" | "lb") => void
}) {
  // Local text state so typing "93.5" doesn't get round-tripped through the
  // numeric parent state, which would strip the trailing dot mid-keystroke
  // and turn "93.5" into "935".
  const [text, setText] = useState<string>(() =>
    weightKg == null
      ? ""
      : unit === "kg"
        ? String(Math.round(weightKg * 10) / 10)
        : String(Math.round(kgToLb(weightKg)))
  )
  const handleUnitChange = (u: "kg" | "lb") => {
    onUnitChange(u)
    if (weightKg != null) {
      setText(
        u === "kg"
          ? String(Math.round(weightKg * 10) / 10)
          : String(Math.round(kgToLb(weightKg)))
      )
    }
  }
  const handleTextChange = (v: string) => {
    setText(v)
    if (v === "" || v === "." || v === "-") return
    const n = Number(v)
    if (!Number.isFinite(n)) return
    onWeightChange(unit === "kg" ? n : lbToKg(n))
  }
  return (
    <div className="flex flex-col gap-6">
      <StepHeading
        title="What do you weigh now?"
        subtitle="This is your starting weight — we'll log it."
      />
      <UnitToggle
        value={unit}
        options={[
          { value: "kg", label: "kg" },
          { value: "lb", label: "lb" },
        ]}
        onChange={handleUnitChange}
      />
      <div className="flex flex-col gap-2">
        <Label htmlFor="weight">Weight ({unit})</Label>
        <Input
          id="weight"
          type="number"
          inputMode="decimal"
          step={unit === "kg" ? 0.1 : 1}
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
        />
      </div>
    </div>
  )
}
