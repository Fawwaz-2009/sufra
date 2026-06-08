import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Clock from "effect/Clock"
import * as Schema from "effect/Schema"
import {
  Estimator,
  type EstimateFailure,
  type EstimateInput,
  type EstimateResult,
  type EstimateUsage
} from "./estimator.ts"
import { MealAnalysis } from "../models/meal-analysis.ts"
import { computeCost, getModel } from "./models.ts"
import { callVisionModel } from "./call.ts"
import { environmentOf, type Bindings } from "../env.ts"

/**
 * The `Estimator` transport layers — the AI leaf split into a real OpenRouter call and a deterministic
 * test double, picked by `EstimatorLayer(env)` off `env.ENVIRONMENT` (Rails' per-environment service,
 * the same shape as the Mailer). ONLY `test` swaps to the double — dev/production both estimate for
 * real, because dogfooding needs real Estimates.
 */

const nowMillis = Clock.currentTimeMillis
const decodeAnalysis = Schema.decodeUnknownSync(MealAnalysis)

// The AI SDK attaches `usage` to NoObjectGeneratedError (and a few others) when the model produced
// billable tokens before failing. Undefined when the failure preceded the model run (no bill).
const extractUsage = (e: unknown): EstimateUsage | undefined => {
  if (e === null || typeof e !== "object") return undefined
  const u = (e as { usage?: { inputTokens?: number; outputTokens?: number } }).usage
  if (!u) return undefined
  return { promptTokens: u.inputTokens ?? 0, completionTokens: u.outputTokens ?? 0 }
}

const classify = (e: unknown): EstimateFailure["code"] => {
  const msg = e instanceof Error ? e.message : String(e)
  if (/no object generated|could not parse|did not match schema/i.test(msg)) return "schema-parse-failed"
  if (/rate|429|quota/i.test(msg)) return "rate-limited"
  return "provider-error"
}

const MESSAGES: Record<EstimateFailure["code"], string> = {
  "rate-limited": "The vision service is busy right now. Try again in a moment.",
  "provider-error": "Couldn't reach the vision service. Try again.",
  "schema-parse-failed": "The AI couldn't read this meal. Try another photo or refine it."
}

export const EstimatorLive = (env: Bindings): Layer.Layer<Estimator> =>
  Layer.succeed(Estimator, {
    estimate: ({ photo, modelId, userText }: EstimateInput) =>
      Effect.gen(function* () {
        const model = getModel(modelId)
        const start = yield* nowMillis

        // Run the vision model via the SHARED `callVisionModel` (the same call the eval harness runs, so
        // prod and evals never drift — locale is hardcoded "en" here, the v1 prod path). A provider throw
        // is a DOMAIN outcome (the user is waiting on a synchronous create), so it stays in the typed
        // channel — not a defect. The sync `catch` keeps the raw pieces; `matchEffect` stamps latency from
        // the Clock on BOTH paths (a sync catch can't).
        const generate = Effect.tryPromise({
          try: () => callVisionModel({ apiKey: env.OPENROUTER_API_KEY, modelId, photo, locale: "en", userText }),
          catch: (e) => ({ code: classify(e), usage: extractUsage(e) })
        })

        return yield* Effect.matchEffect(generate, {
          onFailure: (partial) =>
            Effect.gen(function* () {
              const end = yield* nowMillis
              return yield* Effect.fail<EstimateFailure>({
                code: partial.code,
                message: MESSAGES[partial.code],
                modelId,
                usage: partial.usage,
                costUsd: partial.usage ? computeCost(model, partial.usage) : undefined,
                latencyMs: end - start
              })
            }),
          onSuccess: (result) =>
            Effect.gen(function* () {
              const latencyMs = (yield* nowMillis) - start
              const usage: EstimateUsage = {
                promptTokens: result.usage.inputTokens ?? 0,
                completionTokens: result.usage.outputTokens ?? 0
              }
              // Validate the model's output against the SAME schema that produced its JSON Schema — the
              // drift-net. A mismatch is a schema-parse failure that already billed, so carry the usage.
              const analysis = yield* Effect.try({
                try: () => decodeAnalysis(result.output),
                catch: (): EstimateFailure => ({
                  code: "schema-parse-failed",
                  message: MESSAGES["schema-parse-failed"],
                  modelId,
                  usage,
                  costUsd: computeCost(model, usage),
                  latencyMs
                })
              })
              return {
                analysis,
                modelId,
                usage,
                costUsd: computeCost(model, usage),
                latencyMs
              } satisfies EstimateResult
            })
        })
      })
  })

/**
 * The deterministic test double — selected for `ENVIRONMENT="test"` so meal-create request tests never
 * touch OpenRouter (the `OPENROUTER_API_KEY` is a placeholder in the request pool). It returns a fixed,
 * analyzable Estimate with zero cost.
 */
const TEST_ANALYSIS: MealAnalysis = {
  notAnalyzable: false,
  notAnalyzableReason: "",
  dishName: "Test Dish",
  foods: [
    {
      name: "Test Food",
      portionGrams: 200,
      portionEstimate: 1,
      portionUnit: "serving",
      estimatedKcal: 500,
      estimatedProteinG: 30,
      estimatedCarbsG: 50,
      estimatedFatG: 20,
      confidence: "high"
    }
  ],
  clarifications: [],
  overallConfidence: "high"
}

export const EstimatorTest: Layer.Layer<Estimator> = Layer.succeed(Estimator, {
  estimate: ({ modelId }: EstimateInput) =>
    Effect.succeed({
      analysis: TEST_ANALYSIS,
      modelId,
      usage: { promptTokens: 0, completionTokens: 0 },
      costUsd: 0,
      latencyMs: 0
    } satisfies EstimateResult)
})

/** Pick the transport by environment — Rails' per-environment service. Fail-closed: an unrecognized
 *  ENVIRONMENT lands on `EstimatorLive`, never the test double. */
export const EstimatorLayer = (env: Bindings): Layer.Layer<Estimator> =>
  environmentOf(env) === "test" ? EstimatorTest : EstimatorLive(env)
