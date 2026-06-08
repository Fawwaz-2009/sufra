import * as Effect from "effect/Effect"
import * as Clock from "effect/Clock"
import * as Schema from "effect/Schema"
import { MealsRepo } from "../../db/meals.ts"
import { run } from "../../db/sql.ts"
import { CurrentMeal } from "../../contract/middleware/meal-scoped.ts"
import { MealOverride } from "../../models/meal-analysis.ts"

const nowIso = Effect.map(Clock.currentTimeMillis, (ms) => new Date(ms).toISOString())

// The override column is JSON stored as TEXT; encode the object to its row value (a JSON string).
const encodeOverride = Schema.encodeSync(Schema.fromJsonString(MealOverride))

/**
 * Overridable — the meal's manual Totals correction (CONTEXT "Override"). The `set` IS the rule, in row
 * language: `set` writes the WHOLE override (PUT-replace), `reset` writes SQL NULL. No per-field merge,
 * so there is no null-vs-absent ambiguity left to mishandle (ADR 0012). Both bump `updatedAt`.
 */
export const set = Effect.fn("Meal.override.set")(function* (input: MealOverride) {
  const meal = yield* CurrentMeal
  const meals = yield* MealsRepo
  const now = yield* nowIso
  yield* run(meals.updateWhere({ id: meal.id }, { override: encodeOverride(input), updatedAt: now }))
})

export const reset = Effect.fn("Meal.override.reset")(function* () {
  const meal = yield* CurrentMeal
  const meals = yield* MealsRepo
  const now = yield* nowIso
  yield* run(meals.updateWhere({ id: meal.id }, { override: null, updatedAt: now }))
})
