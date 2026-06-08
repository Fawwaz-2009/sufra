import * as Schema from "effect/Schema"
import * as Model from "effect/unstable/schema/Model"

/**
 * Profile-snapshot model + the Profile vocabulary (enum tuples, numeric bounds, field schemas) — the
 * SINGLE SOURCE OF TRUTH for the shape (ADR 0009). Browser-safe (`models/`), so the frontend imports the
 * enum tuples + bounds for its chips/sliders and the field schemas decode the wire form. Renamed from the
 * old `profile_log` per ADR 0011; the append-only-snapshot + derive-at-read core (ADR 0001/0003) is
 * preserved.
 */

// ── the Profile vocabulary (enum tuples + bounds), browser-safe constants ──
export const SEX_VALUES = ["male", "female"] as const
export const ACTIVITY_LEVELS = ["sedentary", "light", "moderate", "active"] as const
export const HEIGHT_UNITS = ["cm", "imperial"] as const
export const WEIGHT_UNITS = ["kg", "lb"] as const

// Physiological bounds — wide enough for any plausible adult, tight enough to reject unit-confusion
// (lb typed into the kg field). Enforced at the schema boundary so a bad value never reaches the DB.
export const WEIGHT_KG_MIN = 30
export const WEIGHT_KG_MAX = 300
export const HEIGHT_CM_MIN = 100
export const HEIGHT_CM_MAX = 250
export const WEEKLY_RATE_KG_MIN = 0
export const WEEKLY_RATE_KG_MAX = 2

// ── shared field schemas — used BOTH by the model below and by the contract payloads (weights POST), so
// the validation lives in exactly one place. ──
export const Sex = Schema.Literals(SEX_VALUES)
export type Sex = typeof Sex.Type
export const ActivityLevel = Schema.Literals(ACTIVITY_LEVELS)
export type ActivityLevel = typeof ActivityLevel.Type
export const HeightUnit = Schema.Literals(HEIGHT_UNITS)
export type HeightUnit = typeof HeightUnit.Type
export const WeightUnit = Schema.Literals(WEIGHT_UNITS)
export type WeightUnit = typeof WeightUnit.Type

export const WeightKg = Schema.Finite.check(Schema.isBetween({ minimum: WEIGHT_KG_MIN, maximum: WEIGHT_KG_MAX }))
export const HeightCm = Schema.Int.check(Schema.isBetween({ minimum: HEIGHT_CM_MIN, maximum: HEIGHT_CM_MAX }))
export const WeeklyRateKg = Schema.Finite.check(
  Schema.isBetween({ minimum: WEEKLY_RATE_KG_MIN, maximum: WEEKLY_RATE_KG_MAX })
)

/** A local calendar date, `YYYY-MM-DD` (the Member's TZ). `birthday` + `effectiveFrom` use it — Day
 *  segmentation is purely client-side (CONTEXT "Day"; ADR 0002), so dates ride as plain strings. */
export const LocalDate = Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/))

/** Branded id for the `profile_snapshots` table — a UUID v7 generated on insert. */
export const ProfileSnapshotId = Schema.String.pipe(Schema.brand("ProfileSnapshotId"))
export type ProfileSnapshotId = typeof ProfileSnapshotId.Type

/**
 * A Profile snapshot — one immutable row of a Member's plan inputs, keyed by an `effectiveFrom` local
 * date (CONTEXT "Profile snapshot"). The Member's CURRENT profile is the latest row by `effectiveFrom`
 * (ADR 0001); a Profile "edit" is an APPEND of a new complete snapshot, never a mutation (ADR 0011), so
 * the collection is sealed (no update/delete endpoint). Maintenance / Target / macro grams are DERIVED
 * at read from these inputs, never stored (ADR 0003).
 *
 * `jsonCreate` IS the create payload: the client sends the complete snapshot it wants to append (the
 * edit sheets merge the changed field over the latest snapshot they already hold) plus `effectiveFrom`.
 * `id` / `userId` / `createdAt` are server-set. `UNIQUE(userId, effectiveFrom)` + the repo's upsert
 * handle "edited twice the same day" (both target the same row; the latter overwrites — ADR 0002).
 */
export class ProfileSnapshot extends Model.Class<ProfileSnapshot>("ProfileSnapshot")({
  id: Model.UuidV7Insert(ProfileSnapshotId),

  // FK to users(id) — NO db constraint (inline-join approach). Set from CurrentUser, never client-sent.
  userId: Model.FieldExcept(["jsonCreate", "jsonUpdate"])(Schema.String),

  // The local date this snapshot takes effect (CONTEXT "Day"). Onboarding sends today; an edit sends
  // tomorrow (today's plan stays sealed — ADR 0002). Client-sent (only the client knows the TZ).
  effectiveFrom: LocalDate,

  sex: Sex,
  birthday: LocalDate,
  heightCm: HeightCm,
  displayHeightUnit: HeightUnit,
  weightKg: WeightKg,
  displayWeightUnit: WeightUnit,
  activityLevel: ActivityLevel,
  goalWeightKg: WeightKg,
  weeklyRateKg: WeeklyRateKg,

  createdAt: Model.DateTimeInsert
}) {}
