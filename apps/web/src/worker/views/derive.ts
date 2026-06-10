import type { ActivityLevel } from "../models/profile-snapshot.ts"
import type { ProfileSnapshotView } from "./profile-snapshot.ts"

/**
 * The Profile derivation — Mifflin-St Jeor BMR → Maintenance → Target → macro grams, plus the
 * snapshot-for-a-day resolver. Pure + browser-safe (lives on the read/view side per ADR 0011), so BOTH
 * the worker (server-side reads, e.g. Slice 5's calorie-history) and the SPA (the Day Summary ring, the
 * in-sheet live preview) compute the same numbers from one formula. Derived values are NEVER stored
 * (ADR 0003) — recomputed on every read.
 */

// Structural sub-type: the formula consumes only the inputs that feed Mifflin (ADR 0004 — derive when
// structural). Any ProfileSnapshotView satisfies it.
export type ProfileInputs = Pick<
  ProfileSnapshotView,
  "sex" | "birthday" | "heightCm" | "weightKg" | "activityLevel" | "goalWeightKg" | "weeklyRateKg"
>

export interface ProfileDerived {
  readonly ageYears: number
  readonly bmrKcal: number
  readonly maintenanceKcal: number
  readonly targetKcal: number
  readonly macros: {
    readonly proteinG: number
    readonly carbsG: number
    readonly fatG: number
  }
  readonly direction: -1 | 0 | 1
}

// Activity multipliers applied to Mifflin BMR → Maintenance. Standard nutrition convention paired with
// Mifflin-St Jeor (sedentary / lightly active / moderately active / very active).
export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725
}

// Wishnofsky's ~7,700 kcal/kg of fat, divided across 7 days → the daily kcal delta for 1 kg/week.
const KCAL_PER_KG_PER_WEEK = 7700 / 7
const MACRO_SPLIT = { protein: 0.25, carbs: 0.5, fat: 0.25 } as const
const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 } as const

export function ageFromBirthday(birthday: string, now: Date = new Date()): number {
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

export function deriveProfile(p: ProfileInputs, now: Date = new Date()): ProfileDerived {
  const ageYears = ageFromBirthday(p.birthday, now)
  const bmrKcal = bmrMifflin(p, now)
  const maintenanceKcal = bmrKcal * ACTIVITY_MULTIPLIERS[p.activityLevel]
  const direction = sign(p.goalWeightKg - p.weightKg)
  const targetKcal = Math.round(maintenanceKcal + direction * p.weeklyRateKg * KCAL_PER_KG_PER_WEEK)
  const macros = {
    proteinG: Math.round((targetKcal * MACRO_SPLIT.protein) / KCAL_PER_GRAM.protein),
    carbsG: Math.round((targetKcal * MACRO_SPLIT.carbs) / KCAL_PER_GRAM.carbs),
    fatG: Math.round((targetKcal * MACRO_SPLIT.fat) / KCAL_PER_GRAM.fat)
  }
  return { ageYears, bmrKcal, maintenanceKcal, targetKcal, macros, direction }
}

function sign(n: number): -1 | 0 | 1 {
  if (n > 0) return 1
  if (n < 0) return -1
  return 0
}

/**
 * The snapshot active for a given local date — the latest row whose `effectiveFrom` is on or before
 * `localDate`. Snapshots must be sorted DESC by `effectiveFrom` (as `/me` returns them). Returns null
 * when no snapshot is yet active for that date (e.g. a date before onboarding).
 */
export function snapshotFor<T extends { readonly effectiveFrom: string }>(
  snapshots: ReadonlyArray<T>,
  localDate: string
): T | null {
  for (const s of snapshots) {
    if (s.effectiveFrom <= localDate) return s
  }
  return null
}
