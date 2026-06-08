import { useState } from "react"
import { toast } from "sonner"

import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { tomorrowLocalDate } from "@/lib/date"
import type { ActivityLevel } from "../../../worker/profile/isomorphic/constants"

// Shared mutation hook used by every Profile sheet. Wraps the PATCH call,
// pipes errors to a toast, refreshes the auth context (which holds the
// canonical profile timeline used by the Day view and this page), and
// surfaces a `saving` flag for the Save button.
export function useProfilePatch() {
  const auth = useAuth()
  const [saving, setSaving] = useState(false)

  const save = async (patch: Record<string, unknown>) => {
    setSaving(true)
    try {
      const res = await api.api.profile.$patch({
        json: {
          ...patch,
          effectiveFrom: tomorrowLocalDate(),
        } as Parameters<typeof api.api.profile.$patch>[0]["json"],
      })
      if (!res.ok) {
        toast.error("Couldn't save. Try again.")
        return false
      }
      await auth.refresh()
      toast.success("Saved — starts tomorrow.")
      return true
    } finally {
      setSaving(false)
    }
  }

  return { save, saving }
}

// Display labels for activity-level enum values. Used by both AboutYouSection
// (read-only display in the row) and ActivitySheet (chip labels).
export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: "Sedentary",
  light: "Light",
  moderate: "Moderate",
  active: "Active",
}

export const ACTIVITY_DESCRIPTIONS: Record<ActivityLevel, string> = {
  sedentary: "Little or no exercise",
  light: "Exercise 1–3 days/week",
  moderate: "Exercise 3–5 days/week",
  active: "Exercise 6–7 days/week",
}
