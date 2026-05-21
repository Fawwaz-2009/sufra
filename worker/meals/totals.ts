// Resolves a Meal's per-field Totals via override-first composition:
// `override.field ?? sum(foods.field)`. Override wins per-field over the
// estimate; absent overrides fall back to the AI per-food breakdown.
// See ADR 0003 — Totals are not stored on the meal row; they are computed
// on every read by this helper.

import type { MealOverride } from "../db/schema"
import type { MealAnalysis } from "./estimator/schema"

export type ResolvedTotals = {
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
}

export function resolveTotals(
  analysis: MealAnalysis,
  override: MealOverride | null
): ResolvedTotals {
  const o = override ?? {}
  return {
    kcal: o.kcal ?? sumField(analysis, "estimatedKcal"),
    proteinG: o.proteinG ?? sumField(analysis, "estimatedProteinG"),
    carbsG: o.carbsG ?? sumField(analysis, "estimatedCarbsG"),
    fatG: o.fatG ?? sumField(analysis, "estimatedFatG"),
  }
}

function sumField(
  analysis: MealAnalysis,
  k:
    | "estimatedKcal"
    | "estimatedProteinG"
    | "estimatedCarbsG"
    | "estimatedFatG"
): number {
  return analysis.foods.reduce((acc, f) => acc + f[k], 0)
}
