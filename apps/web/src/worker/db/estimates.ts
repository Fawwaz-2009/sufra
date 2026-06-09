import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { Estimate } from "../models/estimate.ts"
import { makeTable } from "./table.ts"
import { command, type Command } from "./sql.ts"

/**
 * The estimates repository — the append-only attempt log (CONTEXT "Estimate"; ADR 0017).
 *
 *  - `create`         — APPEND one attempt (ok or failed). The meal's current Estimate is the latest "ok".
 *  - `currentForMeal` — the latest "ok" attempt (the meal's current Estimate), for paths that read it directly.
 *  - `deleteForMeal`  — drop every attempt of a meal: the app-level cascade (D1 has no FK cascade), called
 *    from `Meal.destroy` and the member-delete cascade. The `inference_runs` ledger is NOT touched (decoupled).
 *
 * The MEAL reads (`db/meals.ts`) already join the current analysis + latest status onto each meal, so most
 * read paths never need this repo — it backs the append, the cascade, and the occasional direct read.
 */
const make = Effect.gen(function* () {
  const { sql, create } = yield* makeTable(Estimate, "estimates")

  const currentForMeal = (mealId: string): Command<Option.Option<typeof Estimate.select.Type>> => ({
    statement: Effect.sync(
      () => sql`SELECT * FROM estimates WHERE mealId = ${mealId} AND status = 'ok' ORDER BY createdAt DESC LIMIT 1`
    ),
    decode: (rows) =>
      rows.length === 0
        ? Effect.succeed(Option.none())
        : Schema.decodeUnknownEffect(Estimate.select)(rows[0]).pipe(Effect.orDie, Effect.map(Option.some))
  })

  const deleteForMeal = (mealId: string): Command<void> =>
    command(() => sql`DELETE FROM estimates WHERE mealId = ${mealId}`)

  return { create, currentForMeal, deleteForMeal } as const
})

export interface EstimatesRepo extends Effect.Success<typeof make> {}
export const EstimatesRepo = Context.Service<EstimatesRepo>("app/estimates/EstimatesRepo")
export const EstimatesRepoLayer = Layer.effect(EstimatesRepo, make)
