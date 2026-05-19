import { z } from "zod"

// Single source of truth for the meal-analysis output shape.
// Imported by the Worker (production analysis route) and by the eval harness.
//
// User-read strings (must be in user's locale per multi-language design):
//   - dishName
//   - foods[i].name
//   - clarifications[i].question / clarifications[i].options[]
//   - notAnalyzableReason
// Everything else (units, numeric values, IDs) stays locale-neutral.

const Confidence = z.enum(["high", "medium", "low"])

const Food = z.object({
  name: z.string(),
  portionGrams: z.number(),
  portionEstimate: z.number(),
  portionUnit: z.string(),
  estimatedKcal: z.number(),
  estimatedProteinG: z.number(),
  estimatedCarbsG: z.number(),
  estimatedFatG: z.number(),
  confidence: Confidence,
})

// OpenAI strict-mode JSON schema requires every property in `required`. `options`
// is always emitted (possibly empty) rather than truly optional.
const Clarification = z.object({
  id: z.string(),
  question: z.string(),
  type: z.enum(["binary", "choice", "scale"]),
  options: z.array(z.string()),
})

export const MealAnalysis = z.object({
  // Non-food / unanalyzable escape hatch — required so the model has an honest
  // way out instead of confabulating "0.5 servings of dog" for a pet photo.
  // The route should check this first and return a typed error to the user.
  notAnalyzable: z.boolean(),
  notAnalyzableReason: z.string(),

  // The model's best guess at what a human would call this meal as a whole.
  // Single-dish photos: the dish name ("Kabsa", "Big Mac"). Mixed-plate photos:
  // a natural description ("Fruit and grain breakfast plate"). Empty string
  // when notAnalyzable is true.
  dishName: z.string(),

  // foods is empty iff notAnalyzable is true. No `.min(1)` — that was forcing
  // the model to invent food for non-food photos. Source of truth for all
  // macros: the meal's totals are computed by the consumer as
  // `sum(foods[i].estimatedKcal)` etc. No denormalized top-level totals.
  foods: z.array(Food),
  clarifications: z.array(Clarification),
  overallConfidence: Confidence,
})

export type MealAnalysis = z.infer<typeof MealAnalysis>
