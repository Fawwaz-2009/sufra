import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { Meal } from "../models/meal.ts"
import { makeTable } from "./table.ts"
import { type Command } from "./sql.ts"

/**
 * The meals repository — CRUD from `makeTable` plus three named reads, all scoped through the Member
 * (load-is-authorizing, so a meal that isn't yours is simply absent → 404 upstream):
 *
 *  - `inRange` — the Day view: a Member's meals in a captured-at range, newest first.
 *  - `saved`   — the Saved Meals list (the `GET /meals?saved` scope).
 *  - `find`    — one meal by its own id, through the Member (backs MealScoped show/sub-resources).
 *
 * Reads decode into `Meal.select` (so `aiAnalysis` JSON → object, `override`/`savedAt` → Option); the
 * domain maps the row to a view as a separate step (the view computes Totals + the proxy photo URL).
 */
const make = Effect.gen(function* () {
  const { sql, create, update, updateWhere, delete: del } = yield* makeTable(Meal, "meals")

  const decodeMany = (rows: ReadonlyArray<unknown>) =>
    Schema.decodeUnknownEffect(Schema.Array(Meal.select))(rows).pipe(Effect.orDie)

  const inRange = (scope: {
    readonly userId: string
    readonly from: string
    readonly to: string
  }): Command<ReadonlyArray<typeof Meal.select.Type>> => ({
    statement: Effect.sync(() => sql`
      SELECT id, userId, capturedAt, aiAnalysis, override, lastRefinementText, savedAt, createdAt, updatedAt
      FROM meals
      WHERE userId = ${scope.userId} AND capturedAt >= ${scope.from} AND capturedAt < ${scope.to}
      ORDER BY createdAt DESC
    `),
    decode: decodeMany
  })

  const saved = (scope: { readonly userId: string }): Command<ReadonlyArray<typeof Meal.select.Type>> => ({
    statement: Effect.sync(() => sql`
      SELECT id, userId, capturedAt, aiAnalysis, override, lastRefinementText, savedAt, createdAt, updatedAt
      FROM meals
      WHERE userId = ${scope.userId} AND savedAt IS NOT NULL
      ORDER BY savedAt DESC
    `),
    decode: decodeMany
  })

  const find = (scope: {
    readonly id: string
    readonly userId: string
  }): Command<Option.Option<typeof Meal.select.Type>> => ({
    statement: Effect.sync(() => sql`
      SELECT id, userId, capturedAt, aiAnalysis, override, lastRefinementText, savedAt, createdAt, updatedAt
      FROM meals
      WHERE id = ${scope.id} AND userId = ${scope.userId}
    `),
    decode: (rows) =>
      rows.length === 0
        ? Effect.succeed(Option.none())
        : Schema.decodeUnknownEffect(Meal.select)(rows[0]).pipe(Effect.orDie, Effect.map(Option.some))
  })

  // Just the ids of a Member's meals — the member-delete cascade walks them to purge each meal's photo
  // (the R2 blobs + attachment rows) before the rows themselves are deleted.
  const idsForUser = (scope: { readonly userId: string }): Command<ReadonlyArray<string>> => ({
    statement: Effect.sync(() => sql`SELECT id FROM meals WHERE userId = ${scope.userId}`),
    decode: (rows) =>
      Schema.decodeUnknownEffect(Schema.Array(Schema.Struct({ id: Schema.String })))(rows).pipe(
        Effect.orDie,
        Effect.map((r) => r.map((x) => x.id))
      )
  })

  return { create, update, updateWhere, delete: del, inRange, saved, find, idsForUser } as const
})

export interface MealsRepo extends Effect.Success<typeof make> {}
export const MealsRepo = Context.Service<MealsRepo>("app/meals/MealsRepo")
export const MealsRepoLayer = Layer.effect(MealsRepo, make)
