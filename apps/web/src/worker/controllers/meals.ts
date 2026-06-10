import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder"
import { api } from "../contract/api.ts"
import { Meal } from "../domain/meal.ts"

/** The meals resource — one thin line per REST action, delegating to the Meal aggregate. */
export const MealsControllerLive = HttpApiBuilder.group(api, "meals", (handlers) =>
  handlers
    .handle("index", ({ query }) => Meal.index(query))
    .handle("show", () => Meal.show())
    .handle("create", ({ payload }) => Meal.create(payload))
    .handle("destroy", () => Meal.destroy())
)
