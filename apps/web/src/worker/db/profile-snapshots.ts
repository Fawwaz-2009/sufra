import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { ProfileSnapshot } from "../models/profile-snapshot.ts"
import { makeTable } from "./table.ts"
import { type Command } from "./sql.ts"

/**
 * The profile-snapshots repository — the append-only Profile history (ADR 0001), exposed through the
 * Member aggregate's `snapshots` concern. The collection is SEALED (no update/delete endpoint — an edit
 * is an append), so the write surface is one `upsert`, plus two reads:
 *
 *  - `upsert` — INSERT a snapshot; ON CONFLICT (userId, effectiveFrom) DO UPDATE in place. This IS the
 *    "edited twice the same day" rule (ADR 0002): a second edit targets the same tomorrow row and
 *    overwrites it. Onboarding's first row never conflicts. `RETURNING *` hands back the resolved row
 *    (on a conflict the EXISTING id is kept — the SET omits id/userId/effectiveFrom), so an edit gets
 *    the real id back; composed into a batch it's harmless (the batch ignores RETURNING).
 *  - `latest` — the current profile: the newest row by `effectiveFrom` (drives the merge + Target read).
 *  - `history` — the full timeline, newest first (the `/me` view; the SPA resolves per-day locally).
 */
const make = Effect.gen(function* () {
  const { sql } = yield* makeTable(ProfileSnapshot, "profile_snapshots")

  const decodeOne = (rows: ReadonlyArray<unknown>) =>
    Schema.decodeUnknownEffect(ProfileSnapshot.select)(rows[0]).pipe(Effect.orDie)
  const decodeMany = (rows: ReadonlyArray<unknown>) =>
    Schema.decodeUnknownEffect(Schema.Array(ProfileSnapshot.select))(rows).pipe(Effect.orDie)

  const upsert = (row: typeof ProfileSnapshot.insert.Encoded): Command<typeof ProfileSnapshot.select.Type> => ({
    statement: Effect.sync(
      () => sql`
        INSERT INTO profile_snapshots ${sql.insert(row as Record<string, unknown>)}
        ON CONFLICT ("userId", "effectiveFrom") DO UPDATE SET
          sex = excluded.sex,
          birthday = excluded.birthday,
          heightCm = excluded.heightCm,
          displayHeightUnit = excluded.displayHeightUnit,
          weightKg = excluded.weightKg,
          displayWeightUnit = excluded.displayWeightUnit,
          activityLevel = excluded.activityLevel,
          goalWeightKg = excluded.goalWeightKg,
          weeklyRateKg = excluded.weeklyRateKg,
          createdAt = excluded.createdAt
        RETURNING *
      `
    ),
    decode: decodeOne
  })

  const latest = (scope: {
    readonly userId: string
  }): Command<Option.Option<typeof ProfileSnapshot.select.Type>> => ({
    statement: Effect.sync(() => sql`
      SELECT * FROM profile_snapshots
      WHERE userId = ${scope.userId}
      ORDER BY effectiveFrom DESC
      LIMIT 1
    `),
    decode: (rows) =>
      rows.length === 0
        ? Effect.succeed(Option.none())
        : Schema.decodeUnknownEffect(ProfileSnapshot.select)(rows[0]).pipe(Effect.orDie, Effect.map(Option.some))
  })

  const history = (scope: {
    readonly userId: string
  }): Command<ReadonlyArray<typeof ProfileSnapshot.select.Type>> => ({
    statement: Effect.sync(() => sql`
      SELECT * FROM profile_snapshots
      WHERE userId = ${scope.userId}
      ORDER BY effectiveFrom DESC
    `),
    decode: decodeMany
  })

  return { upsert, latest, history } as const
})

export interface ProfileSnapshotsRepo extends Effect.Success<typeof make> {}
export const ProfileSnapshotsRepo = Context.Service<ProfileSnapshotsRepo>("app/profile-snapshots/ProfileSnapshotsRepo")
export const ProfileSnapshotsRepoLayer = Layer.effect(ProfileSnapshotsRepo, make)
