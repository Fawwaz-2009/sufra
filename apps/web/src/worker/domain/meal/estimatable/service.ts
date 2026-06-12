import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Clock from "effect/Clock"
import * as Schema from "effect/Schema"
import { Analysis, type EstimateErrorCode } from "../../../models/estimate.ts"
import { callVisionModel } from "./vision.ts"
import { environmentOf, type Bindings } from "../../../env.ts"

/**
 * The Vision seam — the stubbable edge, the Effect translation of "stub the vendor client in tests"
 * (ADR 0017). It does ONE thing: run the vision model and hand back the decoded Analysis + usage, OR a
 * classified transport failure. It does NOT own cost, user-facing copy, or the audit — those are the
 * domain's (the estimatable concern). Swapped per environment by `VisionLayer(env)` like the Mailer/Blobs:
 * ONLY "test" swaps to the deterministic double so meal-create request tests never hit OpenRouter.
 */

export interface VisionUsage {
  readonly promptTokens: number
  readonly completionTokens: number
}

export interface VisionSuccess {
  readonly analysis: Analysis
  readonly usage: VisionUsage
  readonly latencyMs: number
}

/** A classified transport failure. `usage` is present when the model billed tokens before failing (a
 *  schema-parse failure on output the provider charged for) — the concern records that cost. No message
 *  here: the user-facing copy is the domain's, mapped from `code`. */
export interface VisionFailure {
  readonly code: EstimateErrorCode
  readonly usage?: VisionUsage
  readonly latencyMs: number
}

export interface VisionInput {
  readonly modelId: string
  /** Absent = the text source (ADR 0019): the call runs on `userText` alone, no image part. */
  readonly photo?: Uint8Array | undefined
  readonly userText?: string | undefined
  /** The Locale (ADR 0020): a raw client string; `getSystemPrompt` allowlists it (unknown → English). */
  readonly locale?: string | undefined
}

export class Vision extends Context.Service<
  Vision,
  {
    readonly call: (input: VisionInput) => Effect.Effect<VisionSuccess, VisionFailure>
  }
>()("app/Vision") {}

const nowMillis = Clock.currentTimeMillis
const decodeAnalysis = Schema.decodeUnknownSync(Analysis)

// The AI SDK attaches `usage` to NoObjectGeneratedError (and a few others) when the model produced
// billable tokens before failing. Undefined when the failure preceded the model run (no bill).
const extractUsage = (e: unknown): VisionUsage | undefined => {
  if (e === null || typeof e !== "object") return undefined
  const u = (e as { usage?: { inputTokens?: number; outputTokens?: number } }).usage
  if (!u) return undefined
  return { promptTokens: u.inputTokens ?? 0, completionTokens: u.outputTokens ?? 0 }
}

const classify = (e: unknown): EstimateErrorCode => {
  const msg = e instanceof Error ? e.message : String(e)
  if (/no object generated|could not parse|did not match schema/i.test(msg)) return "schema-parse-failed"
  if (/rate|429|quota/i.test(msg)) return "rate-limited"
  return "provider-error"
}

export const VisionLive = (env: Bindings): Layer.Layer<Vision> =>
  Layer.succeed(Vision, {
    call: ({ photo, modelId, userText, locale }: VisionInput) =>
      Effect.gen(function* () {
        const start = yield* nowMillis

        // Run the model via the SHARED `callVisionModel` (the same call evals run). A provider throw is a
        // classified transport failure; `matchEffect` stamps latency from the Clock on BOTH paths.
        const generate = Effect.tryPromise({
          try: () =>
            callVisionModel({ apiKey: env.OPENROUTER_API_KEY, modelId, photo, locale: locale ?? "en", userText }),
          catch: (e) => ({ code: classify(e), usage: extractUsage(e) })
        })

        return yield* Effect.matchEffect(generate, {
          onFailure: (partial) =>
            Effect.gen(function* () {
              const end = yield* nowMillis
              return yield* Effect.fail<VisionFailure>({
                code: partial.code,
                usage: partial.usage,
                latencyMs: end - start
              })
            }),
          onSuccess: (result) =>
            Effect.gen(function* () {
              const latencyMs = (yield* nowMillis) - start
              const usage: VisionUsage = {
                promptTokens: result.usage.inputTokens ?? 0,
                completionTokens: result.usage.outputTokens ?? 0
              }
              // Validate the model's output against the SAME schema that produced its JSON Schema — the
              // drift-net. A mismatch is a schema-parse failure that already billed, so carry the usage.
              return yield* Effect.try({
                try: (): VisionSuccess => ({ analysis: decodeAnalysis(result.output), usage, latencyMs }),
                catch: (): VisionFailure => ({ code: "schema-parse-failed", usage, latencyMs })
              })
            })
        })
      })
  })

/**
 * The deterministic test double — selected for ENVIRONMENT="test" so meal-create request tests never
 * touch OpenRouter (the `OPENROUTER_API_KEY` is a placeholder in the request pool). Returns a fixed,
 * analyzable result with zero usage.
 */
const TEST_ANALYSIS: Analysis = {
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

export const VisionTest: Layer.Layer<Vision> = Layer.succeed(Vision, {
  call: () =>
    Effect.succeed({
      analysis: TEST_ANALYSIS,
      usage: { promptTokens: 0, completionTokens: 0 },
      latencyMs: 0
    } satisfies VisionSuccess)
})

/** Pick the transport by environment — Rails' per-environment service. Fail-closed: an unrecognized
 *  ENVIRONMENT lands on `VisionLive`, never the test double. */
export const VisionLayer = (env: Bindings): Layer.Layer<Vision> =>
  environmentOf(env) === "test" ? VisionTest : VisionLive(env)
