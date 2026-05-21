// Isomorphic per ADR 0005 — no drizzle imports, no runtime side effects.
// Single source of truth for Profile enum tuples and numeric bounds:
//   - worker/db/schema.ts                       (column enum constraints)
//   - worker/profile/schema.ts                  (drizzle-zod refinements)
//   - worker/profile/isomorphic/derive.ts       (ACTIVITY_MULTIPLIERS keys)
//   - src/routes/onboarding.tsx, profile.tsx    (chip lists, sheet bounds)

export const SEX_VALUES = ["male", "female"] as const
export type Sex = (typeof SEX_VALUES)[number]

export const ACTIVITY_LEVELS = [
  "sedentary",
  "light",
  "moderate",
  "active",
] as const
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number]

export const HEIGHT_UNITS = ["cm", "imperial"] as const
export type HeightUnit = (typeof HEIGHT_UNITS)[number]

export const WEIGHT_UNITS = ["kg", "lb"] as const
export type WeightUnit = (typeof WEIGHT_UNITS)[number]

// Physiological bounds enforced at every layer that accepts user input.
// Width chosen to admit any plausible adult while rejecting unit-confusion
// errors (e.g. someone typing pounds into the kg field).
export const WEIGHT_KG_MIN = 30
export const WEIGHT_KG_MAX = 300
export const HEIGHT_CM_MIN = 100
export const HEIGHT_CM_MAX = 250

// Weekly rate of weight change, expressed in kg/week. The slider's two
// non-maintain options are 0.25 and 0.5; the bound here just prevents
// pathological values from reaching the Mifflin derivation.
export const WEEKLY_RATE_KG_MIN = 0
export const WEEKLY_RATE_KG_MAX = 2
