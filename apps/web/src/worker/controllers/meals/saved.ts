import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder"
import { api } from "../../contract/api.ts"
import { Meal } from "../../domain/meal.ts"

/** The saved toggle — POST save / DELETE unsave, 204 both. */
export const SavedControllerLive = HttpApiBuilder.group(api, "saved", (handlers) =>
  handlers
    .handle("create", () => Meal.save())
    .handle("destroy", () => Meal.unsave())
)
