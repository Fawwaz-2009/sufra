import * as Context from "effect/Context"
import * as HttpApiMiddleware from "effect/unstable/httpapi/HttpApiMiddleware"
import * as HttpApiError from "effect/unstable/httpapi/HttpApiError"
import { Meal } from "../../models/meal.ts"
import { CurrentUser } from "./authentication.ts"

/**
 * The meal a member-action or sub-resource request is scoped to — loaded + authorized by `MealScoped`
 * (load-is-authorizing, so a meal that isn't yours is a uniform 404, ADR 0013). It is the Meal ROW
 * (`Meal.select`), not the view: `show` serializes it to a view, the concerns (override/refine/save/
 * clone) read its row fields directly.
 */
export class CurrentMeal extends Context.Service<CurrentMeal, typeof Meal.select.Type>()("app/CurrentMeal") {}

export class MealScoped extends HttpApiMiddleware.Service<
  MealScoped,
  { provides: CurrentMeal; requires: CurrentUser }
>()("app/MealScoped", { error: HttpApiError.NotFound }) {}
