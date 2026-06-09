import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder"
import { api } from "../../contract/api.ts"
import { Meal } from "../../domain/meal.ts"

/** The estimates sub-resource — POST appends a new Estimate (retry/refine) and returns the fresh Meal. */
export const EstimatesControllerLive = HttpApiBuilder.group(api, "estimates", (handlers) =>
  handlers.handle("create", ({ payload }) => Meal.reestimate(payload))
)
