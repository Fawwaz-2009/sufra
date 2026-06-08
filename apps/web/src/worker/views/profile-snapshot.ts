import * as Schema from "effect/Schema"
import { ActivityLevel, HeightUnit, ProfileSnapshot, Sex, WeightUnit } from "../models/profile-snapshot.ts"

/**
 * The Profile-snapshot view — one immutable plan-input row, plain JSON (so `.Type === .Encoded`, no
 * brand / DateTime on the wire). Browser-safe: the SPA type-imports it, picks the snapshot active for a
 * day with `snapshotFor`, and derives Target / macros with `deriveProfile` (both in `views/derive.ts`).
 * `createdAt` is intentionally omitted — the timeline orders by `effectiveFrom`, and nothing reads the
 * audit stamp.
 */
export const ProfileSnapshotView = Schema.Struct({
  id: Schema.String,
  effectiveFrom: Schema.String,
  sex: Sex,
  birthday: Schema.String,
  heightCm: Schema.Number,
  displayHeightUnit: HeightUnit,
  weightKg: Schema.Number,
  displayWeightUnit: WeightUnit,
  activityLevel: ActivityLevel,
  goalWeightKg: Schema.Number,
  weeklyRateKg: Schema.Number
})
export type ProfileSnapshotView = typeof ProfileSnapshotView.Type
export type ProfileSnapshotViewEncoded = typeof ProfileSnapshotView.Encoded

/** Serialize a snapshot row → its view (a separate step from the read — "ask for a row, you get a row"). */
export const toProfileSnapshotView = (row: typeof ProfileSnapshot.select.Type): ProfileSnapshotView => ({
  id: row.id,
  effectiveFrom: row.effectiveFrom,
  sex: row.sex,
  birthday: row.birthday,
  heightCm: row.heightCm,
  displayHeightUnit: row.displayHeightUnit,
  weightKg: row.weightKg,
  displayWeightUnit: row.displayWeightUnit,
  activityLevel: row.activityLevel,
  goalWeightKg: row.goalWeightKg,
  weeklyRateKg: row.weeklyRateKg
})
