import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import type { MealAnalysis } from "../models/meal-analysis.ts"

/**
 * The Estimator — the AI leaf as an Effect service (ADR 0009). ONE capability: turn a meal photo into
 * an Estimate. The transport (OpenRouter via the AI SDK) IS the implementation, swapped per environment
 * by layer (`EstimatorLive` / `EstimatorTest` — see ./layers.ts), exactly like the Mailer. The
 * `EstimatorTest` layer returns a deterministic Estimate so meal-create request tests never hit
 * OpenRouter.
 */

/** Tokens billed for one run — carried through to the `inference_run` audit. */
export interface EstimateUsage {
  readonly promptTokens: number
  readonly completionTokens: number
}

/** A successful Estimate, plus the cost/usage the audit log records. */
export interface EstimateResult {
  readonly analysis: MealAnalysis
  readonly modelId: string
  readonly usage: EstimateUsage
  readonly costUsd: number
  readonly latencyMs: number
}

/**
 * A failed run. The error channel is a DOMAIN failure (the user is waiting on a synchronous create, so
 * "the AI couldn't estimate this" is a typed outcome the client shows, not a defect). It carries the
 * billable `usage` when the model already ran (a schema-parse failure on output the provider charged
 * for), so the domain can still record the cost before re-raising — the bill is ground truth.
 */
export interface EstimateFailure {
  readonly message: string
  readonly code: "rate-limited" | "provider-error" | "schema-parse-failed"
  readonly modelId: string
  readonly usage?: EstimateUsage
  readonly costUsd?: number
  readonly latencyMs: number
}

export interface EstimateInput {
  readonly photo: Uint8Array
  readonly modelId: string
  readonly userText?: string
}

export class Estimator extends Context.Service<
  Estimator,
  {
    readonly estimate: (input: EstimateInput) => Effect.Effect<EstimateResult, EstimateFailure>
  }
>()("app/Estimator") {}
