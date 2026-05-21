import { useState } from "react"

import type { ProfileSnapshot } from "../../../../worker/profile/schema"
import { GoalSheet } from "./goal-sheet"
import { Row, SectionCard } from "./section-card"

export function GoalSection({ profile }: { profile: ProfileSnapshot }) {
  const [open, setOpen] = useState(false)
  const direction =
    profile.goalWeightKg < profile.weightKg
      ? "Lose"
      : profile.goalWeightKg > profile.weightKg
        ? "Gain"
        : "Maintain"
  const sub =
    direction === "Maintain"
      ? "Holding current weight"
      : `${direction} to ${profile.goalWeightKg} kg · ~${profile.weeklyRateKg} kg/wk`
  return (
    <SectionCard label="Goal">
      <Row label={direction} value={sub} onClick={() => setOpen(true)} />
      <GoalSheet open={open} onOpenChange={setOpen} profile={profile} />
    </SectionCard>
  )
}
