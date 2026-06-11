import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { Meal, Photo } from "../models/meal.ts"
import { MealRow } from "../views/meal.ts"
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
 * Every read JOINS the meal's Estimate log (ADR 0017): `cur` is the CURRENT Estimate (latest "ok") for
 * its `analysis`; `lat` is the latest ATTEMPT (any status) for the retry signal (`status`/`errorCode`) +
 * the last Refinement note. The photo slot is LEFT-JOINED for its key (`photoKey` — null on a
 * text-created Meal, ADR 0019), matched on the `Photo` slot consts so reader and writer agree by
 * reference. Reads decode into `MealRow` (the `views/meal.ts` shape the serializers map).
 */
const make = Effect.gen(function* () {
  const { sql, create, update, updateWhere, delete: del } = yield* makeTable(Meal, "meals")

  const decodeMany = (rows: ReadonlyArray<unknown>) =>
    Schema.decodeUnknownEffect(Schema.Array(MealRow))(rows).pipe(Effect.orDie)

  const inRange = (scope: {
    readonly userId: string
    readonly from: string
    readonly to: string
  }): Command<ReadonlyArray<MealRow>> => ({
    statement: Effect.sync(() => sql`
      SELECT m.id AS id, m.capturedAt AS capturedAt, m.override AS override, m.savedAt AS savedAt,
             a.key AS photoKey, cur.analysis AS currentAnalysis,
             lat.refinementText AS lastRefinementText, lat.status AS latestStatus, lat.errorCode AS latestErrorCode
      FROM meals m
      LEFT JOIN attachments a ON a.recordType = ${Photo.recordType} AND a.recordId = m.id AND a.name = ${Photo.name}
      LEFT JOIN estimates cur ON cur.id =
        (SELECT id FROM estimates WHERE mealId = m.id AND status = 'ok' ORDER BY createdAt DESC LIMIT 1)
      LEFT JOIN estimates lat ON lat.id =
        (SELECT id FROM estimates WHERE mealId = m.id ORDER BY createdAt DESC LIMIT 1)
      WHERE m.userId = ${scope.userId} AND m.capturedAt >= ${scope.from} AND m.capturedAt < ${scope.to}
      ORDER BY m.createdAt DESC
    `),
    decode: decodeMany
  })

  const saved = (scope: { readonly userId: string }): Command<ReadonlyArray<MealRow>> => ({
    statement: Effect.sync(() => sql`
      SELECT m.id AS id, m.capturedAt AS capturedAt, m.override AS override, m.savedAt AS savedAt,
             a.key AS photoKey, cur.analysis AS currentAnalysis,
             lat.refinementText AS lastRefinementText, lat.status AS latestStatus, lat.errorCode AS latestErrorCode
      FROM meals m
      LEFT JOIN attachments a ON a.recordType = ${Photo.recordType} AND a.recordId = m.id AND a.name = ${Photo.name}
      LEFT JOIN estimates cur ON cur.id =
        (SELECT id FROM estimates WHERE mealId = m.id AND status = 'ok' ORDER BY createdAt DESC LIMIT 1)
      LEFT JOIN estimates lat ON lat.id =
        (SELECT id FROM estimates WHERE mealId = m.id ORDER BY createdAt DESC LIMIT 1)
      WHERE m.userId = ${scope.userId} AND m.savedAt IS NOT NULL
      ORDER BY m.savedAt DESC
    `),
    decode: decodeMany
  })

  const find = (scope: {
    readonly id: string
    readonly userId: string
  }): Command<Option.Option<MealRow>> => ({
    statement: Effect.sync(() => sql`
      SELECT m.id AS id, m.capturedAt AS capturedAt, m.override AS override, m.savedAt AS savedAt,
             a.key AS photoKey, cur.analysis AS currentAnalysis,
             lat.refinementText AS lastRefinementText, lat.status AS latestStatus, lat.errorCode AS latestErrorCode
      FROM meals m
      LEFT JOIN attachments a ON a.recordType = ${Photo.recordType} AND a.recordId = m.id AND a.name = ${Photo.name}
      LEFT JOIN estimates cur ON cur.id =
        (SELECT id FROM estimates WHERE mealId = m.id AND status = 'ok' ORDER BY createdAt DESC LIMIT 1)
      LEFT JOIN estimates lat ON lat.id =
        (SELECT id FROM estimates WHERE mealId = m.id ORDER BY createdAt DESC LIMIT 1)
      WHERE m.id = ${scope.id} AND m.userId = ${scope.userId}
    `),
    decode: (rows) =>
      rows.length === 0
        ? Effect.succeed(Option.none())
        : Schema.decodeUnknownEffect(MealRow)(rows[0]).pipe(Effect.orDie, Effect.map(Option.some))
  })

  // Just the ids of a Member's meals — the member-delete cascade walks them to purge each meal's photo
  // (the R2 blobs + attachment rows) + its estimates before the rows themselves are deleted.
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
