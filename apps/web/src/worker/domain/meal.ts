import * as Effect from "effect/Effect"
import * as Clock from "effect/Clock"
import * as Option from "effect/Option"
import * as HttpApiError from "effect/unstable/httpapi/HttpApiError"
import { MealsRepo } from "../db/meals.ts"
import { EstimatesRepo } from "../db/estimates.ts"
import { run, atomically } from "../db/sql.ts"
import { CurrentUser } from "../contract/middleware/authentication.ts"
import { CurrentMeal } from "../contract/middleware/meal-scoped.ts"
import type { Upload } from "../contract/upload.ts"
import { Photo } from "../models/meal.ts"
import { toMealListItemView, toMealView } from "../views/meal.ts"
import { Settings } from "./settings.ts"
import * as Attachable from "./concerns/attachable.ts"
import * as Estimatable from "./meal/estimatable/index.ts"
import * as Overridable from "./meal/overridable.ts"
import * as Saveable from "./meal/saveable.ts"

const nowIso = Effect.map(Clock.currentTimeMillis, (ms) => new Date(ms).toISOString())

// The photo slot, bound from the model's declaration. Used by create/re-estimate/clone here and exposed
// as `Meal.photo` for the proxy serve controller.
const photoSlot = Attachable.one(Photo)

// Re-read a meal with its current Estimate joined (the wire view). The write paths create/append rows,
// then read back through this so the view reflects the new current state. The meal was just written, so a
// miss is a defect (die), never a typed 404 (that keeps create's error channel to the media errors).
const viewMeal = Effect.fn("Meal.view")(function* (mealId: string, userId: string) {
  const meals = yield* MealsRepo
  const row = yield* run(meals.find({ id: mealId, userId }))
  if (Option.isNone(row)) return yield* Effect.die(new Error(`meal ${mealId} vanished after write`))
  return toMealView(row.value)
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
 * Create (CLAUDE.md "Meals lifecycle"; ADR 0017/0019): the Member supplies a photo and/or a `userText`
 * description — AT LEAST ONE (the BadRequest backstop; the UI enforces it). Validate the photo when
 * present (so we never spend tokens on a non-image), create the Meal row, attach the photo, THEN run the
 * first Estimate — photo(+text) or, with no photo, text-only. The userText rides the Estimate row (it is
 * the Meal's text source material, CONTEXT "User text"); the ledger kind is "estimate" either way (the
 * create door is the first read, not a Refinement). The Estimate is appended as a child (ok OR failed) —
 * a failed first attempt leaves the meal with no current Estimate, which the client shows as "couldn't
 * estimate — retry". So create ALWAYS returns 201 + the meal; the AI failing is data in the view
 * (`latestStatus`/`latestErrorCode`), not an HTTP error.
 */
const create = Effect.fn("Meal.create")(function* (input: {
  readonly photo?: Upload | undefined
  readonly userText?: string | undefined
  readonly capturedAt?: string | undefined
  readonly locale?: string | undefined
}) {
  const { id: userId } = yield* CurrentUser
  const meals = yield* MealsRepo

  const text = input.userText?.trim()
  if (input.photo === undefined && (text === undefined || text === "")) {
    return yield* Effect.fail(new HttpApiError.BadRequest())
  }
  if (input.photo !== undefined) yield* photoSlot.validate(input.photo)

  const now = yield* nowIso
  const meal = yield* run(
    meals.create({
      userId,
      capturedAt: input.capturedAt ?? now,
      override: Option.none(),
      savedAt: Option.none()
    })
  )
  if (input.photo !== undefined) yield* photoSlot.attach(meal.id, input.photo)

  const modelId = yield* Settings.visionModelId()
  yield* Estimatable.estimate({
    mealId: meal.id,
    userId,
    modelId,
    photo: input.photo?.data,
    userText: text,
    locale: input.locale,
    kind: "estimate"
  })

  return yield* viewMeal(meal.id, userId)
})

/**
 * Re-estimate — append a new Estimate against the meal's SOURCE material (CONTEXT "Refinement"; ADR 0019).
 * With a photo in the slot: the photo + the optional new text (the original behavior). With an empty slot
 * (a text-created Meal): a text-only re-run — the new text, or the latest attempt's stored text, so a bare
 * retry re-runs the description and the text the call USED is persisted on the new row (the description
 * stays alive for the next retry/display). With payload text it is a Refinement; without, a plain retry.
 * The current Estimate is always the latest "ok", so a failed re-estimate is recorded (cost + retry)
 * WITHOUT wiping a prior good one. Returns the fresh view.
 */
const reestimate = Effect.fn("Meal.reestimate")(function* (input: {
  readonly userText?: string | undefined
  readonly locale?: string | undefined
}) {
  const meal = yield* CurrentMeal
  const { id: userId } = yield* CurrentUser

  const photo = yield* photoSlot.read(meal.id)
  const text = input.userText?.trim()
  const resolvedText = Option.isNone(photo) ? (text ?? meal.lastRefinementText ?? undefined) : text
  // No photo AND no text anywhere — unreachable through create (the at-least-one rule), so 404 like a
  // missing photo always did.
  if (Option.isNone(photo) && resolvedText === undefined) return yield* new HttpApiError.NotFound()

  const modelId = yield* Settings.visionModelId()
  yield* Estimatable.estimate({
    mealId: meal.id,
    userId,
    modelId,
    photo: Option.isSome(photo) ? photo.value.bytes : undefined,
    userText: resolvedText,
    locale: input.locale,
    kind: text ? "refinement" : "estimate"
  })

  return yield* viewMeal(meal.id, userId)
})

/**
 * Add or replace the Meal's photo (ADR 0019) — a pure media swap that NEVER re-estimates: the standing
 * Estimate is untouched (the Member already accepted it; new bytes are presentation + future source).
 * The next Refinement reads the slot, so re-runs upgrade to photo+text automatically.
 */
const attachPhoto = Effect.fn("Meal.attachPhoto")(function* (input: { readonly photo: Upload }) {
  const meal = yield* CurrentMeal
  yield* photoSlot.attach(meal.id, input.photo)
})

/**
 * Clone — re-log a Saved Meal as a brand-new, independent Meal (ADR 0008): copy the source's CURRENT
 * Estimate (a copy, not a re-run — no AI call, no cost), its override, and the photo bytes; never the
 * `savedAt` or refinement trace. Returns 201 + the new Meal.
 */
const clone = Effect.fn("Meal.clone")(function* (input: { readonly capturedAt?: string | undefined }) {
  const src = yield* CurrentMeal
  const { id: userId } = yield* CurrentUser
  const meals = yield* MealsRepo
  const estimates = yield* EstimatesRepo

  const now = yield* nowIso
  const cloned = yield* run(
    meals.create({
      userId,
      capturedAt: input.capturedAt ?? now,
      override: src.override === null ? Option.none() : Option.some(src.override),
      savedAt: Option.none()
    })
  )

  // Copy the source's current Estimate onto the clone — a copy, so zero tokens/latency and NO ledger entry.
  const srcEstimate = yield* run(estimates.currentForMeal(src.id))
  if (Option.isSome(srcEstimate)) {
    const e = srcEstimate.value
    yield* run(
      estimates.create({
        mealId: cloned.id,
        status: "ok",
        analysis: e.analysis,
        refinementText: Option.none(),
        errorCode: Option.none(),
        modelId: e.modelId,
        promptTokens: 0,
        completionTokens: 0,
        latencyMs: 0
      })
    )
  }

  yield* photoSlot.copy(src.id, cloned.id)
  return yield* viewMeal(cloned.id, userId)
})

const destroy = Effect.fn("Meal.destroy")(function* () {
  const meal = yield* CurrentMeal
  const meals = yield* MealsRepo
  const estimates = yield* EstimatesRepo
  // App-level cascade (D1 has no FK cascade): drop the meal's Estimate log + the meal row together, then
  // purge the photo (dependent: purge_later). The inference_runs ledger is NOT touched — it survives
  // (decoupled; the bill is ground truth, ADR 0017).
  yield* atomically([estimates.deleteForMeal(meal.id), meals.delete({ id: meal.id })])
  yield* Attachable.purgeRecord(Photo.recordType, meal.id)
})

/**
 * THE MEAL AGGREGATE — its own verbs plus the concerns mixed in. `estimate` is the estimatable concern
 * (run via create/reestimate); `override` groups the sub-thing (Meal.override.set/.reset); save/unsave
 * spread flat; `photo` is the bound Attachable slot (Meal.photo.attach/read/copy), used here and by the
 * proxy-serve controller. Consumers call `Meal.*`, never a concern directly.
 */
export const Meal = {
  index,
  show,
  create,
  reestimate,
  attachPhoto,
  clone,
  destroy,
  ...Saveable, // Meal.save / Meal.unsave
  override: Overridable, // Meal.override.set / .reset
  photo: photoSlot // Meal.photo.attach / read / copy
} as const
