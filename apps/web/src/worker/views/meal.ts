import * as Schema from "effect/Schema"
import * as Option from "effect/Option"
import { Meal } from "../models/meal.ts"
import { Confidence, MealAnalysis, MealOverride } from "../models/meal-analysis.ts"

/**
 * Meal views — the wire shapes for the Day list and the meal detail. Browser-safe (the frontend
 * type-imports these + calls `resolveTotals` for live override preview). Two computed augmentations the
 * row can't supply on its own: the override-first `totals` (ADR 0003) and the stable `photoUrl` — the
 * authenticated-proxy path `/api/meals/:id/photo` (ADR 0014), non-effectful (no signing). v1 requires a
 * photo at create, so `photoUrl` is always present.
 */

export interface ResolvedTotals {
  readonly kcal: number
  readonly proteinG: number
  readonly carbsG: number
  readonly fatG: number
}

type MacroField = "estimatedKcal" | "estimatedProteinG" | "estimatedCarbsG" | "estimatedFatG"

const sumField = (analysis: MealAnalysis, k: MacroField): number =>
  analysis.foods.reduce((acc, f) => acc + f[k], 0)

/**
 * Override-first Totals resolution (CONTEXT "Total"; ADR 0003): `override.field ?? sum(foods[i].field)`.
 * Pure + browser-safe, so the override editor recomputes it locally on every keystroke for live preview.
 * Totals are never stored — computed on every read.
 */
export const resolveTotals = (analysis: MealAnalysis, override: MealOverride | null): ResolvedTotals => {
  const o = override ?? {}
  return {
    kcal: o.kcal ?? sumField(analysis, "estimatedKcal"),
    proteinG: o.proteinG ?? sumField(analysis, "estimatedProteinG"),
    carbsG: o.carbsG ?? sumField(analysis, "estimatedCarbsG"),
    fatG: o.fatG ?? sumField(analysis, "estimatedFatG")
  }
}

const Totals = Schema.Struct({
  kcal: Schema.Number,
  proteinG: Schema.Number,
  carbsG: Schema.Number,
  fatG: Schema.Number
})

/** The Day-view list item — the user-facing dishName + confidence lifted out of the Estimate, plus the
 *  resolved Totals + photo URL. NOT the full Estimate (that's the detail view). */
export const MealListItemView = Schema.Struct({
  id: Schema.String,
  capturedAt: Schema.String,
  photoUrl: Schema.String,
  dishName: Schema.String,
  overallConfidence: Confidence,
  totals: Totals
})
export type MealListItemView = typeof MealListItemView.Type

/** The meal detail — the full Estimate (per-food breakdown + clarifications), the override (or null),
 *  saved-state, the last Refinement text, and the resolved Totals. */
export const MealView = Schema.Struct({
  id: Schema.String,
  capturedAt: Schema.String,
  photoUrl: Schema.String,
  aiAnalysis: MealAnalysis,
  override: Schema.NullOr(MealOverride),
  savedAt: Schema.NullOr(Schema.String),
  lastRefinementText: Schema.NullOr(Schema.String),
  totals: Totals
})
export type MealView = typeof MealView.Type

const photoUrl = (id: string): string => `/api/meals/${id}/photo`

/** Serialize a meal row → the detail view (Option columns → nullable; Totals + photoUrl computed). */
export const toMealView = (meal: typeof Meal.select.Type): MealView => {
  const override = Option.getOrNull(meal.override)
  return {
    id: meal.id,
    capturedAt: meal.capturedAt,
    photoUrl: photoUrl(meal.id),
    aiAnalysis: meal.aiAnalysis,
    override,
    savedAt: Option.getOrNull(meal.savedAt),
    lastRefinementText: Option.getOrNull(meal.lastRefinementText),
    totals: resolveTotals(meal.aiAnalysis, override)
  }
}

/** Serialize a meal row → the Day-view list item. */
export const toMealListItemView = (meal: typeof Meal.select.Type): MealListItemView => {
  const override = Option.getOrNull(meal.override)
  return {
    id: meal.id,
    capturedAt: meal.capturedAt,
    photoUrl: photoUrl(meal.id),
    dishName: meal.aiAnalysis.dishName,
    overallConfidence: meal.aiAnalysis.overallConfidence,
    totals: resolveTotals(meal.aiAnalysis, override)
  }
}
