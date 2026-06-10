import * as Effect from "effect/Effect"
import * as Clock from "effect/Clock"
import { MealsRepo } from "../../db/meals.ts"
import { run } from "../../db/sql.ts"
import { CurrentMeal } from "../../contract/middleware/meal-scoped.ts"

const nowIso = Effect.map(Clock.currentTimeMillis, (ms) => new Date(ms).toISOString())

/**
 * Saveable — the Saved-Meal marker (CONTEXT "Saved Meal"; ADR 0008). State-as-data: a nullable
 * `savedAt` timestamp, not a boolean. `save` stamps it now, `unsave` clears it — the `set` IS the rule.
 * No separate table; the saved LIST is the `GET /meals?saved` scope.
 */
export const save = Effect.fn("Meal.save")(function* () {
  const meal = yield* CurrentMeal
  const meals = yield* MealsRepo
  const now = yield* nowIso
  yield* run(meals.updateWhere({ id: meal.id }, { savedAt: now, updatedAt: now }))
})

export const unsave = Effect.fn("Meal.unsave")(function* () {
  const meal = yield* CurrentMeal
  const meals = yield* MealsRepo
  const now = yield* nowIso
  yield* run(meals.updateWhere({ id: meal.id }, { savedAt: null, updatedAt: now }))
})
