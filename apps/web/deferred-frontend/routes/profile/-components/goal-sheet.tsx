import { useMemo, useState } from "react"

import { Label } from "@/components/ui/label"
import { Sheet } from "@/components/ui/sheet"
import { kgToLb } from "@/lib/units"
import { deriveProfile } from "../../../../worker/profile/isomorphic/derive"
import type { ProfileSnapshot } from "../../../../worker/profile/schema"
import { useProfilePatch } from "../-helpers"
import { ChipButton } from "./chip-button"
import { PreviewBox, SheetShell } from "./sheet-shell"

export function GoalSheet({
  open,
  onOpenChange,
  profile,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  profile: ProfileSnapshot
}) {
  const [goalKg, setGoalKg] = useState(profile.goalWeightKg)
  const [rate, setRate] = useState(profile.weeklyRateKg)
  const { save, saving } = useProfilePatch()
  const previous = useMemo(() => deriveProfile(profile).targetKcal, [profile])
  // Integer-kg slider; fractional weights round for thumb position. Display
  // below the track shows the real value with one decimal precision.
  // Range asymmetric: lose up to 60 kg, gain up to 30 — wide enough for
  // realistic goals at any starting weight, bounded by schema's 30–300.
  const currentRounded = Math.round(profile.weightKg)
  const min = Math.max(30, currentRounded - 60)
  const max = Math.min(300, currentRounded + 30)
  const isMaintain = Math.abs(goalKg - profile.weightKg) < 0.5
  const effectiveRate = isMaintain ? 0 : rate
  const direction =
    goalKg < profile.weightKg
      ? "Lose"
      : goalKg > profile.weightKg
        ? "Gain"
        : "Maintain"
  const currentDisplay =
    profile.displayWeightUnit === "kg"
      ? `${Math.round(profile.weightKg * 10) / 10} kg`
      : `${Math.round(kgToLb(profile.weightKg))} lb`
  const valid = isMaintain || rate > 0
  const changed =
    goalKg !== profile.goalWeightKg || effectiveRate !== profile.weeklyRateKg
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetShell
        title="Your goal"
        onSave={async () => {
          if (
            await save({
              goalWeightKg: goalKg,
              weeklyRateKg: effectiveRate,
            })
          )
            onOpenChange(false)
        }}
        saving={saving}
        disabled={!valid || !changed}
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium">{direction}</span>
            <span className="text-2xl font-semibold tabular-nums">
              {goalKg} kg
            </span>
          </div>
          <input
            type="range"
            min={min}
            max={max}
            step={1}
            value={Math.round(goalKg)}
            onChange={(e) => setGoalKg(Number(e.target.value))}
            className="w-full"
            aria-label="Goal weight"
          />
          <div className="flex justify-between text-[10px] tabular-nums text-muted-foreground">
            <span>{min} kg</span>
            <span>Now: {currentDisplay}</span>
            <span>{max} kg</span>
          </div>
        </div>

        {!isMaintain && (
          <div className="flex flex-col gap-2">
            <Label>How fast?</Label>
            <div className="grid grid-cols-2 gap-2">
              <ChipButton
                label="Slowly"
                description="~0.25 kg/wk"
                selected={rate === 0.25}
                onClick={() => setRate(0.25)}
              />
              <ChipButton
                label="Moderately"
                description="~0.5 kg/wk"
                selected={rate === 0.5}
                onClick={() => setRate(0.5)}
              />
            </div>
          </div>
        )}

        <PreviewBox
          inputs={{
            ...profile,
            goalWeightKg: goalKg,
            weeklyRateKg: effectiveRate,
          }}
          previousTarget={previous}
        />
      </SheetShell>
    </Sheet>
  )
}
