import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { getClient, run } from "@/client/api-client"
import { meKey, meQueryOptions } from "@/client/me"
import { tomorrowLocalDate } from "@/lib/date"
import type { ActivityLevel, HeightUnit, Sex, WeightUnit } from "@/worker/models/profile-snapshot"

// A single field-edit on the Profile. A Profile "edit" is an APPEND of a complete immutable snapshot
// effective tomorrow (ADR 0001/0002/0011) — never `weightKg`, which flows only through the Log Weight
// sheet (ADR 0007).
type ProfileEdit = Partial<{
  sex: Sex
  birthday: string
  heightCm: number
  displayHeightUnit: HeightUnit
  displayWeightUnit: WeightUnit
  activityLevel: ActivityLevel
  goalWeightKg: number
  weeklyRateKg: number
}>

// Shared mutation hook used by every Profile sheet. Merges the changed field over the latest snapshot
// (read from the cached `/me`) into a COMPLETE snapshot effective tomorrow, POSTs it, invalidates `/me`,
// and surfaces a `saving` flag for the Save button.
export function useProfilePatch() {
  const queryClient = useQueryClient()
  const { data: me } = useQuery(meQueryOptions())
  const [saving, setSaving] = useState(false)

  const save = async (patch: ProfileEdit) => {
    const latest = me?.profiles[0]
    if (!latest) {
      toast.error("Couldn't save. Try again.")
      return false
    }
    setSaving(true)
    try {
      await run(
        (await getClient()).profileSnapshots.create({
          payload: {
            sex: latest.sex,
            birthday: latest.birthday,
            heightCm: latest.heightCm,
            displayHeightUnit: latest.displayHeightUnit,
            weightKg: latest.weightKg,
            displayWeightUnit: latest.displayWeightUnit,
            activityLevel: latest.activityLevel,
            goalWeightKg: latest.goalWeightKg,
            weeklyRateKg: latest.weeklyRateKg,
            ...patch,
            effectiveFrom: tomorrowLocalDate()
          }
        })
      )
      await queryClient.invalidateQueries({ queryKey: meKey })
      toast.success("Saved — starts tomorrow.")
      return true
    } catch {
      toast.error("Couldn't save. Try again.")
      return false
    } finally {
      setSaving(false)
    }
  }

  return { save, saving }
}

// Display labels for activity-level enum values. Used by both AboutYouSection (read-only display in the
// row) and ActivitySheet (chip labels).
export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: "Sedentary",
  light: "Light",
  moderate: "Moderate",
  active: "Active"
}

export const ACTIVITY_DESCRIPTIONS: Record<ActivityLevel, string> = {
  sedentary: "Little or no exercise",
  light: "Exercise 1–3 days/week",
  moderate: "Exercise 3–5 days/week",
  active: "Exercise 6–7 days/week"
}
