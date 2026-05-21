import { useMemo } from "react"

import { Label } from "@/components/ui/label"
import { kgToLb } from "@/lib/units"
import { cn } from "@/lib/utils"
import { deriveProfile } from "../../../../worker/profile/isomorphic/derive"
import type { Draft } from "../-types"
import { StepHeading } from "./step-heading"

export function StepGoal({
  draft,
  onGoalWeightChange,
  onRateChange,
}: {
  draft: Draft
  onGoalWeightChange: (kg: number) => void
  onRateChange: (r: number) => void
}) {
  const current = draft.weightKg ?? 70
  // Slider operates in integer kg; the Member's actual weight may be
  // fractional (e.g. 93.5). The thumb position uses the rounded value;
  // the "Current" label below shows the real fractional value.
  const currentRounded = Math.round(current)
  const goal = draft.goalWeightKg ?? current
  // Asymmetric range: lose more than you gain, in realistic chunks.
  // Floored/capped at the schema's absolute bounds (30 / 300 kg).
  const min = Math.max(30, currentRounded - 60)
  const max = Math.min(300, currentRounded + 30)
  const isMaintain = Math.abs(goal - current) < 0.5
  const direction =
    goal < current ? "Lose" : goal > current ? "Gain" : "Maintain"
  const diffKg = Math.abs(goal - current)
  const currentDisplay =
    draft.displayWeightUnit === "kg"
      ? `${Math.round(current * 10) / 10} kg`
      : `${Math.round(kgToLb(current))} lb`

  const preview = useMemo(() => {
    if (
      !draft.sex ||
      !draft.birthday ||
      draft.heightCm == null ||
      draft.weightKg == null ||
      !draft.activityLevel ||
      draft.goalWeightKg == null
    ) {
      return null
    }
    return deriveProfile({
      sex: draft.sex,
      birthday: draft.birthday,
      heightCm: draft.heightCm,
      weightKg: draft.weightKg,
      activityLevel: draft.activityLevel,
      goalWeightKg: draft.goalWeightKg,
      weeklyRateKg: draft.weeklyRateKg,
    })
  }, [
    draft.sex,
    draft.birthday,
    draft.heightCm,
    draft.weightKg,
    draft.activityLevel,
    draft.goalWeightKg,
    draft.weeklyRateKg,
  ])

  const etaWeeks =
    !isMaintain && draft.weeklyRateKg > 0 ? diffKg / draft.weeklyRateKg : null

  return (
    <div className="flex flex-col gap-6">
      <StepHeading
        title="Your goal"
        subtitle="Pick a goal weight. Slide to current to maintain."
      />

      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium">{direction}</span>
          <span className="text-2xl font-semibold tabular-nums">
            {goal} kg
          </span>
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={Math.round(goal)}
          onChange={(e) => onGoalWeightChange(Number(e.target.value))}
          className="w-full"
          aria-label="Goal weight"
        />
        <div className="flex justify-between text-[10px] tabular-nums text-muted-foreground">
          <span>{min} kg</span>
          <span>Current: {currentDisplay}</span>
          <span>{max} kg</span>
        </div>
      </div>

      {!isMaintain && (
        <div className="flex flex-col gap-2">
          <Label>How fast?</Label>
          <div className="grid grid-cols-2 gap-2">
            <RateChip
              label="Slowly"
              sub="~0.25 kg/wk"
              selected={draft.weeklyRateKg === 0.25}
              onClick={() => onRateChange(0.25)}
            />
            <RateChip
              label="Moderately"
              sub="~0.5 kg/wk"
              selected={draft.weeklyRateKg === 0.5}
              onClick={() => onRateChange(0.5)}
            />
          </div>
        </div>
      )}

      {preview && (
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Daily target
          </p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">
            {preview.targetKcal}
            <span className="ms-1 text-sm font-normal text-muted-foreground">
              kcal
            </span>
          </p>
          {etaWeeks != null && (
            <p className="mt-2 text-xs text-muted-foreground">
              At this rate, ~{Math.round(etaWeeks)} weeks to reach your goal.
            </p>
          )}
          <p className="mt-3 text-xs tabular-nums text-muted-foreground">
            P {preview.macros.proteinG}g · C {preview.macros.carbsG}g · F{" "}
            {preview.macros.fatG}g
          </p>
        </div>
      )}
    </div>
  )
}

function RateChip({
  label,
  sub,
  selected,
  onClick,
}: {
  label: string
  sub: string
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
        selected
          ? "border-foreground bg-foreground/5"
          : "border-foreground/15 hover:border-foreground/30"
      )}
    >
      <span className="text-sm font-medium">{label}</span>
      <span className="text-[10px] text-muted-foreground">{sub}</span>
    </button>
  )
}
