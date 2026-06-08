import type { Sex } from "@/worker/models/profile-snapshot"
import { ChoiceChip } from "./choice-chip"
import { StepHeading } from "./step-heading"

export function StepSex({
  value,
  onChange,
}: {
  value: Sex | null
  onChange: (v: Sex) => void
}) {
  return (
    <div className="flex flex-col gap-6">
      <StepHeading title="Which formula should we use?" />
      <div className="flex flex-col gap-3">
        <ChoiceChip
          label="Male"
          selected={value === "male"}
          onClick={() => onChange("male")}
        />
        <ChoiceChip
          label="Female"
          selected={value === "female"}
          onClick={() => onChange("female")}
        />
      </div>
    </div>
  )
}
