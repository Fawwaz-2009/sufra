import * as Schema from "effect/Schema"
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup"
import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint"
import * as HttpApiError from "effect/unstable/httpapi/HttpApiError"
import { MealView } from "../../views/meal.ts"
import { MealScoped } from "../middleware/meal-scoped.ts"

/** The re-estimate input — OPTIONAL free-text context. With text it's a Refinement; without, a plain
 *  retry of a failed attempt. Either way it APPENDS a new Estimate (CONTEXT "Refinement"; ADR 0017). */
export const ReestimateInput = Schema.Struct({
  userText: Schema.optional(Schema.String.check(Schema.isMinLength(1))),
  // The Locale (ADR 0020) — see CreateMeal: client state, allowlisted server-side, current-locale-wins
  // on retries/Refinements (an Estimate's language is part of its immutable record).
  locale: Schema.optional(Schema.String)
})

/**
 * Estimates — a PLURAL, create-only sub-resource (ADR 0012/0017). `POST` → `Meal.reestimate`, which
 * appends a new Estimate against the meal's stored photo and returns the fresh `MealView`. The AI failing
 * is DATA in that view (`latestStatus`/`latestErrorCode`), not an HTTP error — so the only error here is
 * the scoping 404. Supersedes the old singular `refinement` sub-resource (replace-in-place is gone — the
 * log is append-only, current = latest "ok").
 */
export const EstimatesGroup = HttpApiGroup.make("estimates")
  .add(
    HttpApiEndpoint.post("create", "/meals/:id/estimates", {
      params: Schema.Struct({ id: Schema.String }),
      payload: ReestimateInput,
      success: MealView,
      error: HttpApiError.NotFound
    })
  )
  .middleware(MealScoped)
