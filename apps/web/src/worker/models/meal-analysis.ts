import * as Schema from "effect/Schema"

/**
 * The meal Estimate — the structured output of the vision model, and the SINGLE SOURCE OF TRUTH for
 * its shape. One Effect `Schema` drives all three consumers, with nothing to drift:
 *   - the estimator (server) sends a JSON Schema DERIVED from it (`MEAL_ANALYSIS_JSON_SCHEMA`) to the
 *     model and decodes the model's output back through THIS schema (the validation + drift-net);
 *   - the `Meal` model stores it as a JSON-TEXT column (`Schema.fromJsonString(MealAnalysis)`);
 *   - the views derive displayed Totals from it (browser-safe).
 *
 * It lives in `models/` (browser-safe), not the server-only `estimator/`, precisely because the
 * views + the model both read the shape. No top-level totals: a meal's kcal/macros are the SUM of the
 * per-food values, resolved override-first in the view (CONTEXT "Total"; ADR 0003).
 *
 * User-read strings (`dishName`, `foods[].name`, `clarifications[].*`, `notAnalyzableReason`) are the
 * fields the prompt localizes; everything else is locale-neutral. v1 ships English-only.
 */
export const Confidence = Schema.Literals(["high", "medium", "low"])
export type Confidence = typeof Confidence.Type

// `Schema.Finite`, NOT `Schema.Number`: a plain Number allows NaN/Infinity, which Effect's JSON Schema
// generator represents as an `anyOf` with `"NaN"`/`"Infinity"` STRING sentinels — noise that would
// confuse the vision model's structured output. Finite emits a clean `{ "type": "number" }`.
const Food = Schema.Struct({
  name: Schema.String,
  portionGrams: Schema.Finite,
  portionEstimate: Schema.Finite,
  portionUnit: Schema.String,
  estimatedKcal: Schema.Finite,
  estimatedProteinG: Schema.Finite,
  estimatedCarbsG: Schema.Finite,
  estimatedFatG: Schema.Finite,
  confidence: Confidence
})

// `options` is always emitted (possibly empty) rather than optional — strict-mode JSON Schema wants
// every declared property required, and the prompt fills it.
const Clarification = Schema.Struct({
  id: Schema.String,
  question: Schema.String,
  type: Schema.Literals(["binary", "choice", "scale"]),
  options: Schema.Array(Schema.String)
})

export const MealAnalysis = Schema.Struct({
  // The non-food / unanalyzable escape hatch — kept so the model has an honest way out instead of
  // confabulating macros for a non-food photo. Dogfooding confirmed `create` need not GATE on it
  // (a ghost meal is rare and self-evident), so the field is retained but not enforced.
  notAnalyzable: Schema.Boolean,
  notAnalyzableReason: Schema.String,

  // The model's best guess at the whole meal's name ("Kabsa", "Big Mac") or a short description for a
  // mixed plate. Empty string when notAnalyzable.
  dishName: Schema.String,

  // The per-food breakdown; the source of all macros (summed downstream). Empty iff notAnalyzable.
  foods: Schema.Array(Food),
  clarifications: Schema.Array(Clarification),
  overallConfidence: Confidence
})
export type MealAnalysis = typeof MealAnalysis.Type

/**
 * The manual Totals correction (CONTEXT "Override"). Each macro is independently OMITTABLE — an absent
 * field falls back to `sum(foods[i].field)` (override-first resolution, ADR 0003). PUT-replace
 * semantics on the override sub-resource mean "what you send IS the override," so there is no null —
 * absence is the only "not overridden" signal (this is what kills the old null-vs-absent PATCH bug).
 */
export const MealOverride = Schema.Struct({
  kcal: Schema.optional(Schema.Finite),
  proteinG: Schema.optional(Schema.Finite),
  carbsG: Schema.optional(Schema.Finite),
  fatG: Schema.optional(Schema.Finite)
})
export type MealOverride = typeof MealOverride.Type

/**
 * The JSON Schema the estimator hands to the vision model for structured output. DERIVED from
 * `MealAnalysis` (the one source of truth) via Effect's generator, then flattened to a single
 * `JSONSchema7`-shaped object the AI SDK's `jsonSchema()` accepts. `additionalProperties: false` +
 * Effect's all-fields-`required` output is exactly what strict structured-output providers want.
 *
 * (Risk noted in docs/refactor-plan.md: an Effect-derived JSON Schema driving OpenRouter strict
 * structured output is unproven in this repo — the real path is exercised by the evals + dogfooding,
 * never by the request tests, which use the deterministic `EstimatorTest` layer.)
 */
const analysisDoc = Schema.toJsonSchemaDocument(MealAnalysis, { additionalProperties: false })
export const MEAL_ANALYSIS_JSON_SCHEMA: Record<string, unknown> = {
  ...analysisDoc.schema,
  ...(Object.keys(analysisDoc.definitions).length > 0 ? { $defs: analysisDoc.definitions } : {})
}
