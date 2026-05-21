// Resolves a Meal's per-field Totals via override-first composition:
// `override.field ?? sum(foods.field)`. Override wins per-field over the
// estimate; absent overrides fall back to the AI per-food breakdown.
//
// Isomorphic per ADR 0005 — pure function, only `import type` from the
// drizzle-bound schema. Imported as a value by both the worker (meals.list,
// meal-detail) and the SPA (OverrideEditor live preview). See ADR 0003 for
// the rationale: Totals are not stored, they are computed on every read.

import type { MealOverride } from "../../db/schema"
import type { MealAnalysis } from "../estimator/schema"

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
