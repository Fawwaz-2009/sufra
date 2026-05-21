import { useMemo, useState } from "react"

import { Input } from "@/components/ui/input"
import { Sheet } from "@/components/ui/sheet"
import { cmToImperial, imperialToCm } from "@/lib/units"
import { deriveProfile } from "../../../../worker/profile/isomorphic/derive"
import type { ProfileSnapshot } from "../../../../worker/profile/schema"
import { useProfilePatch } from "../-helpers"
import { PreviewBox, SheetShell } from "./sheet-shell"
import { UnitToggle } from "./unit-toggle"

export function HeightSheet({
  open,
  onOpenChange,
  profile,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  profile: ProfileSnapshot
}) {
  const [unit, setUnit] = useState<"cm" | "imperial">(profile.displayHeightUnit)
  const [cm, setCm] = useState(profile.heightCm)
  const { save, saving } = useProfilePatch()
  const previous = useMemo(() => deriveProfile(profile).targetKcal, [profile])
  const valid = cm >= 100 && cm <= 250
  const changed = cm !== profile.heightCm || unit !== profile.displayHeightUnit
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetShell
        title="Height"
        onSave={async () => {
          if (await save({ heightCm: cm, displayHeightUnit: unit }))
            onOpenChange(false)
        }}
        saving={saving}
        disabled={!valid || !changed}
      >
        <UnitToggle
          value={unit}
          options={[
            { value: "cm", label: "cm" },
            { value: "imperial", label: "ft + in" },
          ]}
          onChange={setUnit}
        />
        {unit === "cm" ? (
          <Input
            type="number"
            inputMode="numeric"
            value={cm}
            min={100}
            max={250}
            onChange={(e) => {
              const n = Number(e.target.value)
              if (Number.isFinite(n)) setCm(Math.round(n))
            }}
          />
        ) : (
          (() => {
            const { feet, inches } = cmToImperial(cm)
            return (
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  value={feet}
                  min={3}
                  max={8}
                  onChange={(e) => {
                    const n = Number(e.target.value)
                    if (Number.isFinite(n)) setCm(imperialToCm(n, inches))
                  }}
                />
                <Input
                  type="number"
                  value={inches}
                  min={0}
                  max={11}
                  onChange={(e) => {
                    const n = Number(e.target.value)
                    if (Number.isFinite(n)) setCm(imperialToCm(feet, n))
                  }}
                />
              </div>
            )
          })()
        )}
        <PreviewBox
          inputs={{ ...profile, heightCm: cm }}
          previousTarget={previous}
        />
      </SheetShell>
    </Sheet>
  )
}
