import * as Schema from "effect/Schema"
import { MealOverride } from "../models/meal.ts"
import { Analysis, Confidence, EstimateStatus } from "../models/estimate.ts"

/**
 * Meal views — the wire shapes for the Day list and the meal detail. Browser-safe (the frontend
 * type-imports these + calls `resolveTotals` for live override preview).
 *
 * The AI's read now lives in the `estimates` child log (ADR 0017): a meal's CURRENT Estimate is the
 * latest "ok" one, joined in by the meal reads. So `aiAnalysis`/`totals`/`dishName` are NULLABLE — a meal
 * can exist while its first estimate failed (the retry flow) — and `latestStatus`/`latestErrorCode` (the
 * most recent ATTEMPT) drive the retry affordance. Totals stay override-first + derived, never stored
 * (CONTEXT "Total"; ADR 0003). `photoUrl` is the authenticated-proxy path (ADR 0014), non-effectful.
 */

export interface ResolvedTotals {
  readonly kcal: number
  readonly proteinG: number
  readonly carbsG: number
  readonly fatG: number
}

type MacroField = "estimatedKcal" | "estimatedProteinG" | "estimatedCarbsG" | "estimatedFatG"

const sumField = (analysis: Analysis, k: MacroField): number =>
  analysis.foods.reduce((acc, f) => acc + f[k], 0)

/**
 * Override-first Totals resolution (CONTEXT "Total"; ADR 0003): `override.field ?? sum(foods[i].field)`.
 * Pure + browser-safe, so the override editor recomputes it locally on every keystroke for live preview.
 * Totals are never stored — computed on every read from the current Estimate's analysis.
 */
export const resolveTotals = (analysis: Analysis, override: MealOverride | null): ResolvedTotals => {
  const o = override ?? {}
  return {
    kcal: o.kcal ?? sumField(analysis, "estimatedKcal"),
    proteinG: o.proteinG ?? sumField(analysis, "estimatedProteinG"),
    carbsG: o.carbsG ?? sumField(analysis, "estimatedCarbsG"),
    fatG: o.fatG ?? sumField(analysis, "estimatedFatG")
  }
}

/** Map a transport error code (the latest attempt's `latestErrorCode`) → user-facing copy. Lives in the
 *  browser-safe view layer (single source), rendered verbatim by the retry UI — the failure is DATA now
 *  (ADR 0017), not a thrown error carrying a message. */
export const estimateErrorMessage = (code: string | null): string => {
  switch (code) {
    case "rate-limited":
      return "The vision service is busy right now. Try again in a moment."
    case "schema-parse-failed":
      return "The AI couldn't read this meal. Try another photo or refine it."
    default:
      return "Couldn't reach the vision service. Try again."
  }
}

const Totals = Schema.Struct({
  kcal: Schema.Number,
  proteinG: Schema.Number,
  carbsG: Schema.Number,
  fatG: Schema.Number
})

/**
 * What a meal READ decodes into: the meal's own columns + the joined CURRENT Estimate's `analysis` (latest
 * "ok", null if none) and the latest ATTEMPT's `status`/`errorCode`/`refinementText` (the retry signal +
 * the Improve-sheet prefill). The serializers below map it to the wire views; `calorie-history` reads it
 * directly. `override` is decoded straight to `MealOverride | null` here (not Option) — the serializers stay flat.
 */
export const MealRow = Schema.Struct({
  id: Schema.String,
  capturedAt: Schema.String,
  override: Schema.NullOr(Schema.fromJsonString(MealOverride)),
  savedAt: Schema.NullOr(Schema.String),
  currentAnalysis: Schema.NullOr(Schema.fromJsonString(Analysis)),
  lastRefinementText: Schema.NullOr(Schema.String),
  latestStatus: Schema.NullOr(EstimateStatus),
  latestErrorCode: Schema.NullOr(Schema.String)
})
export type MealRow = typeof MealRow.Type

/** The Day-view list item. `dishName`/`overallConfidence`/`totals` are null for a meal whose estimate
 *  hasn't succeeded yet; `latestStatus` lets the list show a "needs retry" affordance. */
export const MealListItemView = Schema.Struct({
  id: Schema.String,
  capturedAt: Schema.String,
  photoUrl: Schema.String,
  dishName: Schema.NullOr(Schema.String),
  overallConfidence: Schema.NullOr(Confidence),
  latestStatus: Schema.NullOr(EstimateStatus),
  totals: Schema.NullOr(Totals)
})
export type MealListItemView = typeof MealListItemView.Type

/** The meal detail — the current Estimate's content (or null), the override, saved-state, the last
 *  Refinement text, the latest attempt's status/errorCode (retry), and the override-first Totals (or null). */
export const MealView = Schema.Struct({
  id: Schema.String,
  capturedAt: Schema.String,
  photoUrl: Schema.String,
  aiAnalysis: Schema.NullOr(Analysis),
  override: Schema.NullOr(MealOverride),
  savedAt: Schema.NullOr(Schema.String),
  lastRefinementText: Schema.NullOr(Schema.String),
  latestStatus: Schema.NullOr(EstimateStatus),
  latestErrorCode: Schema.NullOr(Schema.String),
  totals: Schema.NullOr(Totals)
})
export type MealView = typeof MealView.Type

const photoUrl = (id: string): string => `/api/meals/${id}/photo`

/** Serialize a joined meal row → the detail view. Totals + analysis are null when no Estimate has
 *  succeeded yet (a failed-only meal — the client shows Retry off `latestStatus`/`latestErrorCode`). */
export const toMealView = (row: MealRow): MealView => ({
  id: row.id,
  capturedAt: row.capturedAt,
  photoUrl: photoUrl(row.id),
  aiAnalysis: row.currentAnalysis,
  override: row.override,
  savedAt: row.savedAt,
  lastRefinementText: row.lastRefinementText,
  latestStatus: row.latestStatus,
  latestErrorCode: row.latestErrorCode,
  totals: row.currentAnalysis ? resolveTotals(row.currentAnalysis, row.override) : null
})

/** Serialize a joined meal row → the Day-view list item. */
export const toMealListItemView = (row: MealRow): MealListItemView => ({
  id: row.id,
  capturedAt: row.capturedAt,
  photoUrl: photoUrl(row.id),
  dishName: row.currentAnalysis ? row.currentAnalysis.dishName : null,
  overallConfidence: row.currentAnalysis ? row.currentAnalysis.overallConfidence : null,
  latestStatus: row.latestStatus,
  totals: row.currentAnalysis ? resolveTotals(row.currentAnalysis, row.override) : null
})
