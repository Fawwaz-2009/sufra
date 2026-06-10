import * as Schema from "effect/Schema"
import * as Model from "effect/unstable/schema/Model"
import { sniffImageType, type Slot } from "../contract/upload.ts"

/** Branded id for the `meals` table — a UUID v7 generated on insert. */
export const MealId = Schema.String.pipe(Schema.brand("MealId"))
export type MealId = typeof MealId.Type

/**
 * The manual Totals correction (CONTEXT "Override") — a DETAIL of the Meal, persisted on the meal so it
 * SURVIVES across Estimates (a new estimate must not clear the Member's correction). Each macro is
 * independently OMITTABLE: an absent field falls back to `sum(foods[i].field)` (override-first, ADR
 * 0003). PUT-replace semantics on the override sub-resource mean "what you send IS the override," so
 * absence is the only "not overridden" signal (no null — this is what kills the null-vs-absent bug).
 */
export const MealOverride = Schema.Struct({
  kcal: Schema.optional(Schema.Finite),
  proteinG: Schema.optional(Schema.Finite),
  carbsG: Schema.optional(Schema.Finite),
  fatG: Schema.optional(Schema.Finite)
})
export type MealOverride = typeof MealOverride.Type

/**
 * A Meal — one captured photo a Member logged (CONTEXT "Meal"). The AI's read of it lives in the
 * `estimates` child log (one Meal → many Estimates; the current Estimate is the latest "ok" one), NOT
 * on the meal — so a meal can exist while its first estimate is still failed/pending (the retry flow,
 * ADR 0017). `override` (manual Totals) and `savedAt` live HERE because they belong to the meal, not to
 * any one estimate.
 *
 * The photo is NOT a column — it's the `Photo` slot (below) in the polymorphic `attachments` table (ADR
 * 0014), served via the authenticated proxy `GET /api/meals/:id/photo`. `override` is JSON stored as
 * TEXT (`Schema.fromJsonString`). `userId` + `capturedAt` are server-set (CurrentUser + the create
 * payload), so out of the wire-write variants.
 */
export class Meal extends Model.Class<Meal>("Meal")({
  id: Model.UuidV7Insert(MealId),

  // FK to users(id) — NO db constraint (inline-join approach). Set from CurrentUser, never client-sent.
  userId: Model.FieldExcept(["jsonCreate", "jsonUpdate"])(Schema.String),

  // When the photo was taken (CONTEXT "Day": UTC ISO Z; day-segmentation is client-side by the Member's
  // TZ). Server-resolved from the create payload (`capturedAt ?? now`), so out of the wire write variants.
  capturedAt: Model.FieldExcept(["jsonCreate", "jsonUpdate"])(Schema.String),

  // The manual Totals correction, or none. Written through PUT/DELETE /meals/:id/override.
  override: Model.FieldOption(Schema.fromJsonString(MealOverride)),

  // Saved-for-re-log marker (CONTEXT "Saved Meal"; ADR 0008): non-null ISO ⇒ saved. No separate table —
  // one column is the truth.
  savedAt: Model.FieldOption(Schema.String),

  createdAt: Model.DateTimeInsert,
  updatedAt: Model.DateTimeUpdate
}) {}

/**
 * The meal's photo — Rails' `has_one_attached :photo`, declared HERE on the model (the single source of
 * truth for the slot) with its validation policy. The 4 MB cap is the defensive ceiling (the client
 * resizes before upload); served via the authenticated proxy `GET /api/meals/:id/photo`, never a public
 * URL (ADR 0014). Owned by the meal (recordType "meal"), so the attachment keys by the meal id.
 */
export const Photo = {
  recordType: "meal",
  name: "photo",
  contentTypes: ["image/png", "image/jpeg", "image/webp"],
  maxBytes: 4 * 1024 * 1024,
  sniff: sniffImageType
} satisfies Slot
