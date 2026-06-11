import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import { Vision } from "./service.ts"
import { EstimatesRepo } from "../../../db/estimates.ts"
import { InferenceRunsRepo } from "../../../db/inference-runs.ts"
import { run } from "../../../db/sql.ts"
import { resolveVisionModel, computeCost } from "../../../views/setting.ts"

/**
 * Estimatable — the Meal's "the AI reads this meal" concern (Rails: app/models/meal/estimatable.rb). The
 * Meal aggregate is the only importer; it calls `estimate(...)` from create / re-estimate / clone-copy.
 *
 * This is where the DOMAIN owns what the humble Vision seam does not: it resolves the priced model
 * (`resolveVisionModel`, with the stale-id fallback), runs Vision, APPENDS one Estimate row (ok or
 * failed), and writes the decoupled cost ledger when the call billed. It NEVER throws — a provider
 * failure is a persisted `failed` Estimate (the retry flow, ADR 0017), not an error; the caller re-reads
 * the meal to see the new current state. The model id is passed IN (the Meal resolves it via Settings),
 * so this concern doesn't reach for the Settings aggregate.
 */
export const estimate = Effect.fn("Estimatable.estimate")(function* (input: {
  readonly mealId: string
  readonly userId: string
  readonly modelId: string
  /** Absent = the text source (ADR 0019): Vision runs on `userText` alone. */
  readonly photo?: Uint8Array | undefined
  readonly userText?: string | undefined
  /** The ledger kind is the DOOR, not the text (ADR 0019): the create door is an "estimate" even with
   *  userText present (it's the first read, not a Refinement) — so the caller passes it, never inferred. */
  readonly kind: "estimate" | "refinement"
}) {
  const vision = yield* Vision
  const estimates = yield* EstimatesRepo
  const runs = yield* InferenceRunsRepo

  const model = resolveVisionModel(input.modelId) // graceful fallback if the stored id went stale
  const text = input.userText?.trim()
  const kind = input.kind
  const refinementText = text ? Option.some(text) : Option.none<string>()

  return yield* Effect.matchEffect(vision.call({ modelId: model.id, photo: input.photo, userText: input.userText }), {
    onSuccess: (r) =>
      Effect.gen(function* () {
        const created = yield* run(
          estimates.create({
            mealId: input.mealId,
            status: "ok",
            analysis: Option.some(r.analysis),
            refinementText,
            errorCode: Option.none(),
            modelId: model.id,
            promptTokens: r.usage.promptTokens,
            completionTokens: r.usage.completionTokens,
            latencyMs: r.latencyMs
          })
        )
        yield* run(
          runs.create({
            userId: Option.some(input.userId),
            estimateId: Option.some(created.id),
            modelId: model.id,
            kind,
            costUsd: computeCost(model, r.usage)
          })
        )
        return created
      }),
    onFailure: (f) =>
      Effect.gen(function* () {
        const created = yield* run(
          estimates.create({
            mealId: input.mealId,
            status: "failed",
            analysis: Option.none(),
            refinementText,
            errorCode: Option.some(f.code),
            modelId: model.id,
            promptTokens: f.usage?.promptTokens ?? 0,
            completionTokens: f.usage?.completionTokens ?? 0,
            latencyMs: f.latencyMs
          })
        )
        // Record cost ONLY when the run actually billed (usage present) — the bill is ground truth.
        if (f.usage !== undefined) {
          yield* run(
            runs.create({
              userId: Option.some(input.userId),
              estimateId: Option.some(created.id),
              modelId: model.id,
              kind,
              costUsd: computeCost(model, f.usage)
            })
          )
        }
        return created
      })
  })
})
