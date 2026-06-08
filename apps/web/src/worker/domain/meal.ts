import * as Effect from "effect/Effect"
import * as Clock from "effect/Clock"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import * as HttpApiError from "effect/unstable/httpapi/HttpApiError"
import { MealsRepo } from "../db/meals.ts"
import { InferenceRunsRepo } from "../db/inference-runs.ts"
import { run } from "../db/sql.ts"
import { CurrentUser } from "../contract/middleware/authentication.ts"
import { CurrentMeal } from "../contract/middleware/meal-scoped.ts"
import { EstimateFailed } from "../contract/meals.ts"
import type { Upload } from "../contract/upload.ts"
import { Photo } from "../models/meal.ts"
import { MealAnalysis } from "../models/meal-analysis.ts"
import { toMealListItemView, toMealView } from "../views/meal.ts"
import { Estimator, type EstimateResult } from "../estimator/estimator.ts"
import { DEFAULT_VISION_MODEL_ID } from "../estimator/models.ts"
import * as Attachable from "./concerns/attachable.ts"
import * as Overridable from "./meal/overridable.ts"
import * as Saveable from "./meal/saveable.ts"

const nowIso = Effect.map(Clock.currentTimeMillis, (ms) => new Date(ms).toISOString())
const encodeAnalysis = Schema.encodeSync(Schema.fromJsonString(MealAnalysis))

// The photo slot, bound from the model's declaration. Used by create/refine/clone here and exposed as
// `Meal.photo` for the proxy serve controller.
const photoSlot = Attachable.one(Photo)

// Record one inference run (the decoupled cost audit — survives meal/Member deletion). `userId` and
// `errorCode` are the model's nullable columns (FieldOption), so they take Options.
const recordRun = Effect.fn("Meal.recordRun")(function* (input: {
  readonly userId: string
  readonly kind: "estimate" | "refinement"
  readonly status: "ok" | "failed"
  readonly modelId: string
  readonly promptTokens: number
  readonly completionTokens: number
  readonly costUsd: number
  readonly latencyMs: number
  readonly errorCode: string | null
}) {
  const runs = yield* InferenceRunsRepo
  yield* run(
    runs.create({
      userId: Option.some(input.userId),
      modelId: input.modelId,
      kind: input.kind,
      status: input.status,
      errorCode: Option.fromNullishOr(input.errorCode),
      promptTokens: input.promptTokens,
      completionTokens: input.completionTokens,
      costUsd: input.costUsd,
      latencyMs: input.latencyMs
    })
  )
})

/**
 * Run the estimator and AUDIT it on both paths (cost is ground truth, recorded even when the run failed
 * but still billed), then map the internal failure to the typed `EstimateFailed` the client renders. The
 * shared gate behind create + refine. Model selection is `app_settings` (Slice 4) — defaulted for now.
 */
const runEstimate = Effect.fn("Meal.runEstimate")(function* (input: {
  readonly userId: string
  readonly kind: "estimate" | "refinement"
  readonly photo: Uint8Array
  readonly userText?: string
}) {
  const estimator = yield* Estimator
  return yield* estimator
    .estimate({ photo: input.photo, modelId: DEFAULT_VISION_MODEL_ID, userText: input.userText })
    .pipe(
      Effect.tap((r: EstimateResult) =>
        recordRun({
          userId: input.userId,
          kind: input.kind,
          status: "ok",
          modelId: r.modelId,
          promptTokens: r.usage.promptTokens,
          completionTokens: r.usage.completionTokens,
          costUsd: r.costUsd,
          latencyMs: r.latencyMs,
          errorCode: null
        })
      ),
      Effect.tapError((f) =>
        f.usage === undefined
          ? Effect.void // the run never billed (network/rate before the model ran) — nothing to record
          : recordRun({
              userId: input.userId,
              kind: input.kind,
              status: "failed",
              modelId: f.modelId,
              promptTokens: f.usage.promptTokens,
              completionTokens: f.usage.completionTokens,
              costUsd: f.costUsd ?? 0,
              latencyMs: f.latencyMs,
              errorCode: f.code
            })
      ),
      Effect.mapError((f) => new EstimateFailed({ message: f.message }))
    )
})

// ── the meal's OWN verbs ──

const index = Effect.fn("Meal.index")(function* (query: {
  readonly from?: string | undefined
  readonly to?: string | undefined
  readonly saved?: string | undefined
}) {
  const { id: userId } = yield* CurrentUser
  const meals = yield* MealsRepo
  const rows =
    query.saved !== undefined
      ? yield* run(meals.saved({ userId }))
      : query.from !== undefined && query.to !== undefined
        ? yield* run(meals.inRange({ userId, from: query.from, to: query.to }))
        : []
  return rows.map(toMealListItemView)
})

const show = Effect.fn("Meal.show")(function* () {
  return toMealView(yield* CurrentMeal)
})

/**
 * Synchronous-atomic create (CLAUDE.md "Meals lifecycle"): validate the photo (so we never spend tokens
 * on a non-image), estimate (the gate — nothing persists unless it succeeds), THEN insert the meal row
 * and attach the photo. A row exists ⟺ it has a valid Estimate.
 */
const create = Effect.fn("Meal.create")(function* (input: {
  readonly photo: Upload
  readonly capturedAt?: string | undefined
}) {
  const { id: userId } = yield* CurrentUser
  const meals = yield* MealsRepo

  yield* photoSlot.validate(input.photo)
  const { analysis } = yield* runEstimate({ userId, kind: "estimate", photo: input.photo.data })

  const now = yield* nowIso
  const meal = yield* run(
    meals.create({
      userId,
      capturedAt: input.capturedAt ?? now,
      aiAnalysis: analysis,
      override: Option.none(),
      lastRefinementText: Option.none(),
      savedAt: Option.none()
    })
  )
  yield* photoSlot.attach(meal.id, input.photo)
  return toMealView(meal)
})

/**
 * Refine — re-run the estimator with the Member's text + the SAME photo, REPLACE the Estimate in place
 * (no history), and overwrite `lastRefinementText` (CONTEXT "Refinement"). Returns the fresh view.
 */
const refine = Effect.fn("Meal.refine")(function* (input: { readonly userText: string }) {
  const meal = yield* CurrentMeal
  const { id: userId } = yield* CurrentUser
  const meals = yield* MealsRepo

  const photo = yield* photoSlot.read(meal.id)
  if (Option.isNone(photo)) return yield* new HttpApiError.NotFound()

  const { analysis } = yield* runEstimate({
    userId,
    kind: "refinement",
    photo: photo.value.bytes,
    userText: input.userText
  })
  const now = yield* nowIso
  const updated = yield* run(
    meals.update(meal.id, {
      aiAnalysis: encodeAnalysis(analysis),
      lastRefinementText: input.userText.trim(),
      updatedAt: now
    })
  )
  return toMealView(updated)
})

/**
 * Clone — re-log a Saved Meal as a brand-new, independent Meal: copy the Estimate + override + photo
 * bytes (ADR 0008), never the `savedAt` or refinement trace. Returns 201 + the new Meal.
 */
const clone = Effect.fn("Meal.clone")(function* (input: { readonly capturedAt?: string | undefined }) {
  const src = yield* CurrentMeal
  const { id: userId } = yield* CurrentUser
  const meals = yield* MealsRepo

  const now = yield* nowIso
  const cloned = yield* run(
    meals.create({
      userId,
      capturedAt: input.capturedAt ?? now,
      aiAnalysis: src.aiAnalysis,
      override: src.override,
      lastRefinementText: Option.none(),
      savedAt: Option.none()
    })
  )
  yield* photoSlot.copy(src.id, cloned.id)
  return toMealView(cloned)
})

const destroy = Effect.fn("Meal.destroy")(function* () {
  const meal = yield* CurrentMeal
  const meals = yield* MealsRepo
  yield* run(meals.delete({ id: meal.id }))
  // Purge the photo AFTER the row is gone (dependent: :purge_later). The inference_run audit survives
  // (decoupled). Best-effort R2 cleanup lives in purgeRecord.
  yield* Attachable.purgeRecord(Photo.recordType, meal.id)
})

/**
 * THE MEAL AGGREGATE — its own verbs plus the concerns mixed in. `override` groups the sub-thing
 * (Meal.override.set/.reset); save/unsave spread flat; `photo` is the bound Attachable slot
 * (Meal.photo.attach/read/copy), used by create/refine/clone above and the proxy-serve controller.
 * Consumers call `Meal.*`, never a concern directly.
 */
export const Meal = {
  index,
  show,
  create,
  refine,
  clone,
  destroy,
  ...Saveable, // Meal.save / Meal.unsave
  override: Overridable, // Meal.override.set / .reset
  photo: photoSlot // Meal.photo.attach / read / copy
} as const
