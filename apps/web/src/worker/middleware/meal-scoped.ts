import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import * as HttpRouter from "effect/unstable/http/HttpRouter"
import { CurrentMeal, MealScoped } from "../contract/middleware/meal-scoped.ts"
import { CurrentUser } from "../contract/middleware/authentication.ts"
import { MealsRepo } from "../db/meals.ts"
import { run } from "../db/sql.ts"
import { orNotFound } from "../support/http.ts"

const MealIdParam = Schema.Struct({ id: Schema.String })

/**
 * MealScoped — Rails' `set_meal` before_action. Reads `:id` from the matched route, loads the meal
 * THROUGH the current user (a meal that isn't theirs is simply absent → 404), and provides
 * `CurrentMeal`. Attached to the meal's member actions (`show`/`destroy`) and every sub-resource
 * (override/refinement/saved/clones/photo). The handlers behind it never re-load and never check
 * ownership — the scoped find already did both.
 */
export const MealScopedLive = Layer.effect(
  MealScoped,
  Effect.gen(function* () {
    const meals = yield* MealsRepo
    return (httpEffect, _options) =>
      Effect.gen(function* () {
        const { id } = yield* HttpRouter.schemaPathParams(MealIdParam).pipe(Effect.orDie)
        const user = yield* CurrentUser
        const meal = yield* run(meals.find({ id, userId: user.id })).pipe(orNotFound)
        return yield* Effect.provideService(httpEffect, CurrentMeal, meal)
      })
  })
)
