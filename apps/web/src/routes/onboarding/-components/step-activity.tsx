import type { ActivityLevel } from "@/worker/models/profile-snapshot"
import { ACTIVITY_MULTIPLIERS } from "@/worker/views/derive"
import { ChoiceChip } from "./choice-chip"
import { StepHeading } from "./step-heading"

const ACTIVITY_OPTIONS: ReadonlyArray<{
  value: ActivityLevel
  label: string
  description: string
}> = [
  {
    value: "sedentary",
    label: "Sedentary",
    description: "Little or no exercise",
  },
  { value: "light", label: "Light", description: "Exercise 1–3 days/week" },
  {
    value: "moderate",
    label: "Moderate",
    description: "Exercise 3–5 days/week",
  },
  { value: "active", label: "Active", description: "Exercise 6–7 days/week" },
]

export function StepActivity({
  value,
  onChange,
}: {
  value: ActivityLevel | null
  onChange: (v: ActivityLevel) => void
}) {
  return (
    <div className="flex flex-col gap-6">
      <StepHeading title="How active are you?" />
      <div className="flex flex-col gap-2">
        {ACTIVITY_OPTIONS.map((opt) => (
          <ChoiceChip
            key={opt.value}
            label={opt.label}
            description={opt.description}
            selected={value === opt.value}
            onClick={() => onChange(opt.value)}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Multiplier applied to your BMR: {ACTIVITY_MULTIPLIERS.sedentary}× →{" "}
        {ACTIVITY_MULTIPLIERS.active}×.
      </p>
    </div>
  )
}
