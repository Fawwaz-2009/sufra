import * as Schema from "effect/Schema"
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup"
import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint"
import * as HttpApiError from "effect/unstable/httpapi/HttpApiError"
import { MealView } from "../../views/meal.ts"
import { EstimateFailed } from "../meals.ts"
import { MealScoped } from "../middleware/meal-scoped.ts"

/** The Refinement input — the Member's free-text context, re-run through the model with the photo. */
export const RefineInput = Schema.Struct({
  userText: Schema.String.check(Schema.isMinLength(1))
})

/**
 * The Refinement — a SINGULAR, create-only sub-resource (CONTEXT "Refinement"; ADR 0012). `POST` →
 * `Meal.refine`, which RE-RUNS the estimator and REPLACES the Estimate in place (no history) +
 * overwrites `lastRefinementText`. Returns the fresh `MealView` (the new Estimate is something the
 * client can't otherwise know → 200 + body). `EstimateFailed` rides the same synchronous gate as create.
 */
export const RefinementGroup = HttpApiGroup.make("refinement")
  .add(
    HttpApiEndpoint.post("create", "/meals/:id/refinement", {
      params: Schema.Struct({ id: Schema.String }),
      payload: RefineInput,
      success: MealView,
      error: [HttpApiError.NotFound, EstimateFailed]
    })
  )
  .middleware(MealScoped)
