// Shared isomorphic formula module. Pure functions, no runtime deps. Imported
// by both the worker (server-side reads for Day Summary's Target) and the SPA
// (in-sheet live preview when the Member edits a Profile field, and the
// onboarding goal step's per-chip target previews). See ADR 0003.

export type Sex = "male" | "female"
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active"

export type ProfileInputs = {
  sex: Sex
  birthday: string // YYYY-MM-DD
  heightCm: number
  weightKg: number
  activityLevel: ActivityLevel
  goalWeightKg: number
  weeklyRateKg: number
}

// Full profile_log row shape, JSON-serialized. Display units don't affect any
// formula but ride along with every snapshot; co-locating them here keeps the
// shared "what's in a snapshot" type in one place.
export type ProfileSnapshot = ProfileInputs & {
  id: string
  userId: string
  effectiveFrom: string // YYYY-MM-DD
  createdAt: string // ISO Z timestamp
  displayHeightUnit: "cm" | "imperial"
  displayWeightUnit: "kg" | "lb"
}

export type ProfileDerived = {
  ageYears: number
  bmrKcal: number
  maintenanceKcal: number
  targetKcal: number
  macros: {
    proteinG: number
    carbsG: number
    fatG: number
  }
  direction: -1 | 0 | 1
}

// Activity multipliers applied to Mifflin BMR to produce Maintenance.
// Standard nutrition convention; values match the "sedentary/lightly active/
// moderately active/very active" bands commonly paired with Mifflin-St Jeor.
export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
}

// Wishnofsky's "1 lb of fat ≈ 3,500 kcal" → ~7,700 kcal/kg; divided across
// 7 days gives the daily kcal delta required to lose/gain 1 kg per week.
const KCAL_PER_KG_PER_WEEK = 7700 / 7

const MACRO_SPLIT = { protein: 0.25, carbs: 0.5, fat: 0.25 } as const
const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 } as const

export function ageFromBirthday(
  birthday: string,
  now: Date = new Date()
): number {
  const [yStr, mStr, dStr] = birthday.split("-")
  const by = Number(yStr)
  const bm = Number(mStr)
  const bd = Number(dStr)
  const ny = now.getFullYear()
  const nm = now.getMonth() + 1
  const nd = now.getDate()
  let age = ny - by
  if (nm < bm || (nm === bm && nd < bd)) age -= 1
  return age
}

export function bmrMifflin(
  p: Pick<ProfileInputs, "sex" | "weightKg" | "heightCm" | "birthday">,
  now?: Date
): number {
  const age = ageFromBirthday(p.birthday, now)
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * age
  return p.sex === "male" ? base + 5 : base - 161
}

export function deriveProfile(
  p: ProfileInputs,
  now: Date = new Date()
): ProfileDerived {
  const ageYears = ageFromBirthday(p.birthday, now)
  const bmrKcal = bmrMifflin(p, now)
  const maintenanceKcal = bmrKcal * ACTIVITY_MULTIPLIERS[p.activityLevel]
  const direction = sign(p.goalWeightKg - p.weightKg)
  const targetRaw =
    maintenanceKcal + direction * p.weeklyRateKg * KCAL_PER_KG_PER_WEEK
  const targetKcal = Math.round(targetRaw)
  const macros = {
    proteinG: Math.round(
      (targetKcal * MACRO_SPLIT.protein) / KCAL_PER_GRAM.protein
    ),
    carbsG: Math.round(
      (targetKcal * MACRO_SPLIT.carbs) / KCAL_PER_GRAM.carbs
    ),
    fatG: Math.round((targetKcal * MACRO_SPLIT.fat) / KCAL_PER_GRAM.fat),
  }
  return { ageYears, bmrKcal, maintenanceKcal, targetKcal, macros, direction }
}

function sign(n: number): -1 | 0 | 1 {
  if (n > 0) return 1
  if (n < 0) return -1
  return 0
}

// Picks the snapshot active for a given local date — the latest row whose
// effective_from is on or before `localDate`. Snapshots are expected sorted
// DESC by effective_from (as the GET /api/profile endpoint returns them).
// Returns null if no snapshot is yet active for that date (e.g. asking about
// a date before the Member's onboarding).
export function snapshotFor(
  snapshots: ProfileSnapshot[],
  localDate: string
): ProfileSnapshot | null {
  for (const s of snapshots) {
    if (s.effectiveFrom <= localDate) return s
  }
  return null
}

