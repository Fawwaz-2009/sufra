import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { Weight } from "../models/weight.ts"
import { makeTable } from "./table.ts"
import { command, type Command } from "./sql.ts"

/**
 * The weights repository — the Member's measurement records (ADR 0007, user-correctable). Exposed
 * through the Member aggregate's `weights` concern:
 *
 *  - `insert` — a custom VOID write (the caller pre-encodes the row), so it composes into the atomic
 *    dual-append with the `profile_snapshots` upsert (ADR 0011 — one batch, no partial-failure window).
 *  - `inRange` — the Progress chart: a Member's weights in a logged-at range, oldest first.
 *  - `find`    — one weight by its own id, THROUGH the Member (a weight that isn't theirs is absent →
 *    404 on the delete path; load-is-authorizing).
 *  - `delete`  — from `makeTable`, scoped `{ id, userId }`; weights are deletable (not `profile_snapshots`).
 */
const make = Effect.gen(function* () {
  const { sql, delete: del } = yield* makeTable(Weight, "weights")

  const insert = (row: typeof Weight.insert.Encoded): Command<void> =>
    command(() => sql`INSERT INTO weights ${sql.insert(row as Record<string, unknown>)}`)

  const inRange = (scope: {
    readonly userId: string
    readonly from: string
    readonly to: string
  }): Command<ReadonlyArray<typeof Weight.select.Type>> => ({
    statement: Effect.sync(() => sql`
      SELECT id, userId, weightKg, loggedAt, createdAt
      FROM weights
      WHERE userId = ${scope.userId} AND loggedAt >= ${scope.from} AND loggedAt < ${scope.to}
      ORDER BY loggedAt ASC
    `),
    decode: (rows) => Schema.decodeUnknownEffect(Schema.Array(Weight.select))(rows).pipe(Effect.orDie)
  })

  const find = (scope: {
    readonly id: string
    readonly userId: string
  }): Command<Option.Option<typeof Weight.select.Type>> => ({
    statement: Effect.sync(() => sql`
      SELECT id, userId, weightKg, loggedAt, createdAt
      FROM weights
      WHERE id = ${scope.id} AND userId = ${scope.userId}
    `),
    decode: (rows) =>
      rows.length === 0
        ? Effect.succeed(Option.none())
        : Schema.decodeUnknownEffect(Weight.select)(rows[0]).pipe(Effect.orDie, Effect.map(Option.some))
  })

  return { insert, inRange, find, delete: del } as const
})

export interface WeightsRepo extends Effect.Success<typeof make> {}
export const WeightsRepo = Context.Service<WeightsRepo>("app/weights/WeightsRepo")
export const WeightsRepoLayer = Layer.effect(WeightsRepo, make)
