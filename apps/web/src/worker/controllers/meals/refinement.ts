import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder"
import { api } from "../../contract/api.ts"
import { Meal } from "../../domain/meal.ts"

/** The refinement sub-resource — POST re-runs the estimator and replaces the Estimate in place. */
export const RefinementControllerLive = HttpApiBuilder.group(api, "refinement", (handlers) =>
  handlers.handle("create", ({ payload }) => Meal.refine(payload))
)
