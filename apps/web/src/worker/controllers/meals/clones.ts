import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder"
import { api } from "../../contract/api.ts"
import { Meal } from "../../domain/meal.ts"

/** The clones sub-resource — POST mints a new independent Meal from the source (201 + new Meal). */
export const ClonesControllerLive = HttpApiBuilder.group(api, "clones", (handlers) =>
  handlers.handle("create", ({ payload }) => Meal.clone(payload))
)
