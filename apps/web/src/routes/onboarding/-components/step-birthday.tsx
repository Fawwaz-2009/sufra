import { useMemo } from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatLocalDate, todayLocal } from "@/lib/date"
import { StepHeading } from "./step-heading"

export function StepBirthday({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const max = useMemo(() => formatLocalDate(todayLocal()), [])
  const min = useMemo(() => {
    const d = todayLocal()
    d.setFullYear(d.getFullYear() - 110)
    return formatLocalDate(d)
  }, [])
  return (
    <div className="flex flex-col gap-6">
      <StepHeading
        title="When were you born?"
        subtitle="We use this to compute your age each time we run the formula."
      />
      <div className="flex flex-col gap-2">
        <Label htmlFor="birthday">Birthday</Label>
        <Input
          id="birthday"
          type="date"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  )
}
