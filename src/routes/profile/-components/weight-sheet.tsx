import { useMemo, useState } from "react"

import { Input } from "@/components/ui/input"
import { Sheet } from "@/components/ui/sheet"
import { kgToLb, lbToKg } from "@/lib/units"
import { deriveProfile } from "../../../../worker/profile/isomorphic/derive"
import type { ProfileSnapshot } from "../../../../worker/profile/schema"
import { useProfilePatch } from "../-helpers"
import { PreviewBox, SheetShell } from "./sheet-shell"
import { UnitToggle } from "./unit-toggle"

export function WeightSheet({
  open,
  onOpenChange,
  profile,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  profile: ProfileSnapshot
}) {
  const [unit, setUnit] = useState<"kg" | "lb">(profile.displayWeightUnit)
  const [kg, setKg] = useState(profile.weightKg)
  // Mirror StepWeight's pattern — keep the input text as local string state
  // so typing "93.5" doesn't get its trailing dot stripped mid-keystroke.
  const [text, setText] = useState<string>(() =>
    profile.displayWeightUnit === "kg"
      ? String(Math.round(profile.weightKg * 10) / 10)
      : String(Math.round(kgToLb(profile.weightKg)))
  )
  const { save, saving } = useProfilePatch()
  const previous = useMemo(() => deriveProfile(profile).targetKcal, [profile])
  const valid = kg >= 30 && kg <= 300
  const changed = kg !== profile.weightKg || unit !== profile.displayWeightUnit
  const handleUnitChange = (u: "kg" | "lb") => {
    setUnit(u)
    setText(
      u === "kg"
        ? String(Math.round(kg * 10) / 10)
        : String(Math.round(kgToLb(kg)))
    )
  }
  const handleTextChange = (v: string) => {
    setText(v)
    if (v === "" || v === "." || v === "-") return
    const n = Number(v)
    if (!Number.isFinite(n)) return
    setKg(unit === "kg" ? n : lbToKg(n))
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetShell
        title="Weight"
        onSave={async () => {
          if (await save({ weightKg: kg, displayWeightUnit: unit }))
            onOpenChange(false)
        }}
        saving={saving}
        disabled={!valid || !changed}
      >
        <UnitToggle
          value={unit}
          options={[
            { value: "kg", label: "kg" },
            { value: "lb", label: "lb" },
          ]}
          onChange={handleUnitChange}
        />
        <Input
          type="number"
          inputMode="decimal"
          step={unit === "kg" ? 0.1 : 1}
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
        />
        <PreviewBox
          inputs={{ ...profile, weightKg: kg }}
          previousTarget={previous}
        />
        <p className="text-xs text-muted-foreground">
          Saving here also logs a new weight entry.
        </p>
      </SheetShell>
    </Sheet>
  )
}
