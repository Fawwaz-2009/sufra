import * as Schema from "effect/Schema"
import * as Model from "effect/unstable/schema/Model"
import { MealAnalysis, MealOverride } from "./meal-analysis.ts"
import { sniffImageType, type Slot } from "../contract/upload.ts"

/** Branded id for the `meals` table — a UUID v7 generated on insert. */
export const MealId = Schema.String.pipe(Schema.brand("MealId"))
export type MealId = typeof MealId.Type

/**
 * A Meal — one captured photo + its Estimate, owned by a Member (CONTEXT "Meal"). The create flow is
 * synchronous-atomic: a row exists ⟺ the estimator succeeded, so `aiAnalysis` is NOT NULL and there is
 * no status column (CLAUDE.md "Meals lifecycle").
 *
 * The photo is NOT a column here — it's the optional `Photo` slot (below) in the polymorphic
 * `attachments` table (ADR 0014). "A photo is required" is a create-time rule, not a `NOT NULL`
 * constraint, so a future description-meal keeps ONE Meal shape with no migration.
 *
 * Two JSON-TEXT columns via `Schema.fromJsonString` (Encoded = a JSON string in D1, Type = the decoded
 * object): `aiAnalysis` (the Estimate, server-set by the estimator so out of the wire-write variants)
 * and `override` (the manual Totals correction, written through the override sub-resource). `userId`,
 * `capturedAt`, and `aiAnalysis` are all server-set FKs/values — created via the meal-create payload,
 * not `Meal.jsonCreate`.
 */
export class Meal extends Model.Class<Meal>("Meal")({
  id: Model.UuidV7Insert(MealId),

  // FK to users(id) — NO db constraint (inline-join approach). Set from CurrentUser, never client-sent.
  userId: Model.FieldExcept(["jsonCreate", "jsonUpdate"])(Schema.String),

  // When the photo was taken (CONTEXT "Day": UTC ISO Z; day-segmentation is client-side by the
  // Member's TZ). Server-resolved from the create payload (`capturedAt ?? now`), so out of the wire
  // write variants.
  capturedAt: Model.FieldExcept(["jsonCreate", "jsonUpdate"])(Schema.String),

  // The Estimate — set by the estimator at create/refine, never a client write. Stored as JSON TEXT.
  aiAnalysis: Model.FieldExcept(["jsonCreate", "jsonUpdate"])(Schema.fromJsonString(MealAnalysis)),

  // The manual Totals correction, or none. Written through PUT/DELETE /meals/:id/override.
  override: Model.FieldOption(Schema.fromJsonString(MealOverride)),

  // The Member's most recent Refinement text — prefilled into the Improve sheet so they can see + amend
  // what they last told the AI. Latest replaces latest, no history (CONTEXT "Refinement").
  lastRefinementText: Model.FieldOption(Schema.String),

  // Saved-for-re-log marker (CONTEXT "Saved Meal"; ADR 0008): non-null ISO timestamp ⇒ saved. No
  // separate `saved_meal` table — one column is the truth.
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
