import * as Context from "effect/Context"
import * as HttpApiMiddleware from "effect/unstable/httpapi/HttpApiMiddleware"
import * as HttpApiError from "effect/unstable/httpapi/HttpApiError"
import { MealRow } from "../../views/meal.ts"
import { CurrentUser } from "./authentication.ts"

/**
 * The meal a member-action or sub-resource request is scoped to — loaded + authorized by `MealScoped`
 * (load-is-authorizing, so a meal that isn't yours is a uniform 404, ADR 0013). It is the joined `MealRow`
 * (the meal's columns + its current Estimate's analysis + the latest attempt's status — ADR 0017), not the
 * wire view: `show` serializes it; the concerns (override/save/clone/re-estimate) read its row fields directly.
 */
export class CurrentMeal extends Context.Service<CurrentMeal, MealRow>()("app/CurrentMeal") {}

export class MealScoped extends HttpApiMiddleware.Service<
  MealScoped,
  { provides: CurrentMeal; requires: CurrentUser }
>()("app/MealScoped", { error: HttpApiError.NotFound }) {}
