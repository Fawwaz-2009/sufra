import type {
  ActivityLevel,
  Sex,
} from "@/worker/models/profile-snapshot"

export type Draft = {
  sex: Sex | null
  birthday: string
  heightCm: number | null
  displayHeightUnit: "cm" | "imperial"
  weightKg: number | null
  displayWeightUnit: "kg" | "lb"
  activityLevel: ActivityLevel | null
  goalWeightKg: number | null
  weeklyRateKg: number
}

export const INITIAL_DRAFT: Draft = {
  sex: null,
  birthday: "",
  heightCm: null,
  displayHeightUnit: "cm",
  weightKg: null,
  displayWeightUnit: "kg",
  activityLevel: null,
  goalWeightKg: null,
  weeklyRateKg: 0,
}

export type Step = 1 | 2 | 3 | 4 | 5 | 6

export function isStepValid(step: Step, draft: Draft): boolean {
  switch (step) {
    case 1:
      return draft.sex !== null
    case 2:
      return /^\d{4}-\d{2}-\d{2}$/.test(draft.birthday)
    case 3:
      return (
        draft.heightCm != null &&
        draft.heightCm >= 100 &&
        draft.heightCm <= 250
      )
    case 4:
      return (
        draft.weightKg != null && draft.weightKg >= 30 && draft.weightKg <= 300
      )
    case 5:
      return draft.activityLevel !== null
    case 6: {
      // Maintain (goal = current) is valid with rate = 0; non-maintain needs
      // an explicit rate chip.
      if (draft.goalWeightKg == null || draft.weightKg == null) return false
      const isMaintain = Math.abs(draft.goalWeightKg - draft.weightKg) < 0.001
      return isMaintain ? draft.weeklyRateKg === 0 : draft.weeklyRateKg > 0
    }
    default:
      return false
  }
}
