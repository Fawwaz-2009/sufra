import * as Schema from "effect/Schema"
import * as Model from "effect/unstable/schema/Model"

/**
 * The Estimate — the AI's read of a Meal, reified as an APPEND-ONLY attempt log: one Meal has MANY
 * Estimates over time (create makes the first; each Refinement or retry appends another). The Meal's
 * CURRENT Estimate is the latest row with status "ok"; older rows and failed attempts are history,
 * kept for the retry flow + the cost trail (ADR 0017).
 *
 * `Analysis` is a DETAIL of the Estimate, not a peer concept — it lives here, exported so the vision
 * call (`domain/meal/estimatable/vision.ts`, which derives the provider JSON Schema from it) and the
 * eval harness decode the SAME shape. No top-level totals: a meal's kcal/macros are the SUM of the
 * per-food values, resolved override-first in the view (CONTEXT "Total"; ADR 0003). v1 is English-only.
 */
export const Confidence = Schema.Literals(["high", "medium", "low"])
export type Confidence = typeof Confidence.Type

// `Schema.Finite`, not `Schema.Number`: Finite emits a clean `{ "type": "number" }` in the derived JSON
// Schema; a plain Number adds NaN/Infinity STRING sentinels that confuse the model's structured output.
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

// `options` is always emitted (possibly empty) — strict-mode JSON Schema wants every property required.
const Clarification = Schema.Struct({
  id: Schema.String,
  question: Schema.String,
  type: Schema.Literals(["binary", "choice", "scale"]),
  options: Schema.Array(Schema.String)
})

/**
 * The content of an Estimate — the structured vision-model output, and the single source of truth for
 * its shape. `notAnalyzable` is the honest "this isn't food" escape hatch: a SUCCESSFUL call's verdict,
 * distinct from a FAILED estimate (where the call itself broke) — kept so the model needn't confabulate
 * macros for a non-food photo. `dishName`/`foods` are empty when notAnalyzable.
 */
export const Analysis = Schema.Struct({
  notAnalyzable: Schema.Boolean,
  notAnalyzableReason: Schema.String,
  dishName: Schema.String,
  foods: Schema.Array(Food),
  clarifications: Schema.Array(Clarification),
  overallConfidence: Confidence
})
export type Analysis = typeof Analysis.Type

/** Branded id for the `estimates` table — a UUID v7 generated on insert. */
export const EstimateId = Schema.String.pipe(Schema.brand("EstimateId"))
export type EstimateId = typeof EstimateId.Type

/** The transport outcome of one attempt. "ok" ⇒ `analysis` present; "failed" ⇒ `analysis` None + `errorCode` set. */
export const EstimateStatus = Schema.Literals(["ok", "failed"])
export type EstimateStatus = typeof EstimateStatus.Type

/** The classified failure code, mirrored from the Vision seam's classification. */
export const EstimateErrorCode = Schema.Literals(["rate-limited", "provider-error", "schema-parse-failed"])
export type EstimateErrorCode = typeof EstimateErrorCode.Type

/**
 * An Estimate row — one estimator attempt against a Meal's photo. Created ONLY by the domain (the
 * `estimatable` concern), never from a wire payload, so every field is server-set. It records the
 * `analysis` (JSON-TEXT, None on failure), the `refinementText` that produced it (None ⇒ a plain
 * (re)try, present ⇒ a Refinement), the failure `errorCode` (None when ok), and the per-attempt
 * token/latency facts. The COST itself is the decoupled `inference_runs` ledger (it survives Meal
 * deletion); this row dies with the meal.
 */
export class Estimate extends Model.Class<Estimate>("Estimate")({
  id: Model.UuidV7Insert(EstimateId),
  mealId: Schema.String, // soft FK to meals(id) — NO db constraint; the domain cascades on delete
  status: EstimateStatus,
  analysis: Model.FieldOption(Schema.fromJsonString(Analysis)),
  refinementText: Model.FieldOption(Schema.String),
  errorCode: Model.FieldOption(EstimateErrorCode),
  modelId: Schema.String,
  promptTokens: Schema.Int,
  completionTokens: Schema.Int,
  latencyMs: Schema.Int,
  createdAt: Model.DateTimeInsert
}) {}
