import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder"
import { api } from "../../contract/api.ts"
import { Meal } from "../../domain/meal.ts"

/** The override sub-resource — PUT set / DELETE reset, routed to the aggregate's grouped concern. */
export const OverrideControllerLive = HttpApiBuilder.group(api, "override", (handlers) =>
  handlers
    .handle("update", ({ payload }) => Meal.override.set(payload))
    .handle("destroy", () => Meal.override.reset())
)
