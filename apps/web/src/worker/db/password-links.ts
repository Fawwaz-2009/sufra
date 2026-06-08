import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { PasswordLink } from "../models/password-link.ts"
import { makeTable } from "./table.ts"
import { command, type Command } from "./sql.ts"

/**
 * The password-links repository (ADR 0016), exposed through the `PasswordLink` aggregate:
 *
 *  - `upsert`        — issue OR regenerate the single link per Member (the caller pre-encodes the row, so
 *    the minted token rides in). ON CONFLICT (userId) DO UPDATE replaces it IN PLACE (the SET keeps the
 *    existing id), so first-issue and reset are one path. RETURNING * hands back the resolved row.
 *  - `findByToken`   — the public show + redeem lookup (`None` → uniform 404; the domain also checks TTL).
 *  - `deleteByToken` — consume the link the moment the password is set (redeem).
 *  - `deleteForUser` — the member-delete cascade (no FK, so the app deletes explicitly).
 */
const make = Effect.gen(function* () {
  const { sql } = yield* makeTable(PasswordLink, "password_links")

  const upsert = (row: typeof PasswordLink.insert.Encoded): Command<typeof PasswordLink.select.Type> => ({
    statement: Effect.sync(() => sql`
      INSERT INTO password_links ${sql.insert(row as Record<string, unknown>)}
      ON CONFLICT ("userId") DO UPDATE SET
        token = excluded.token,
        createdBy = excluded.createdBy,
        createdAt = excluded.createdAt,
        expiresAt = excluded.expiresAt
      RETURNING *
    `),
    decode: (rows) => Schema.decodeUnknownEffect(PasswordLink.select)(rows[0]).pipe(Effect.orDie)
  })

  const findByToken = (token: string): Command<Option.Option<typeof PasswordLink.select.Type>> => ({
    statement: Effect.sync(() => sql`
      SELECT id, userId, token, createdBy, createdAt, expiresAt FROM password_links WHERE token = ${token}
    `),
    decode: (rows) =>
      rows.length === 0
        ? Effect.succeed(Option.none())
        : Schema.decodeUnknownEffect(PasswordLink.select)(rows[0]).pipe(Effect.orDie, Effect.map(Option.some))
  })

  const deleteByToken = (token: string): Command<void> =>
    command(() => sql`DELETE FROM password_links WHERE token = ${token}`)

  const deleteForUser = (userId: string): Command<void> =>
    command(() => sql`DELETE FROM password_links WHERE userId = ${userId}`)

  return { upsert, findByToken, deleteByToken, deleteForUser } as const
})

export interface PasswordLinksRepo extends Effect.Success<typeof make> {}
export const PasswordLinksRepo = Context.Service<PasswordLinksRepo>("app/password-links/PasswordLinksRepo")
export const PasswordLinksRepoLayer = Layer.effect(PasswordLinksRepo, make)
