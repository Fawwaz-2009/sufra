import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { User } from "../models/user.ts"
import { MemberView } from "../views/member.ts"
import { makeTable } from "./table.ts"
import { command, type Command } from "./sql.ts"

const CountRow = Schema.Struct({ n: Schema.Int })

/**
 * The users repository — app-owned rows keyed ONE-TO-ONE by the Better Auth identity id (the shared
 * primary key). The credential fields (username/role) stay on `identities` and are read LIVE via an
 * inline-projection JOIN (ADR 0010 — never mirrored as an app column):
 *
 *  - `provision`   — idempotent insert of the app row for a new identity (the sign-up hook).
 *  - `delete`      — remove ONE user row by id (the member-delete cascade; composed with the meal/
 *    snapshot/weight/link deletes in `User.members.destroy`).
 *  - `countHosts`   — the Setup gate ("zero Hosts → needs Setup").
 *  - `countMembers` — the Member count (role = member, Host-EXCLUDING per CONTEXT) — the divisor for
 *    the per-Member inference-cost average.
 *  - `listAccounts` — the Admin list: the FULL household (Hosts included, role projected for the badge).
 *  - `findMember` — the role-scoped 404 gate (verifies `role = member`, so the Host can't
 *    delete/issue-link against themselves or a missing account).
 *  - `usernameOf`  — the credential handle for a userId (the public password-link show).
 */
const make = Effect.gen(function* () {
  const { sql, delete: del } = yield* makeTable(User, "users")

  const provision = (input: { readonly id: string; readonly now: string }): Command<void> =>
    command(
      () => sql`
        INSERT OR IGNORE INTO users (id, createdAt, updatedAt)
        VALUES (${input.id}, ${input.now}, ${input.now})
      `
    )

  const countHosts = (): Command<number> => ({
    statement: Effect.sync(() => sql`SELECT COUNT(*) AS n FROM "identities" WHERE role = 'host'`),
    decode: (rows) => Schema.decodeUnknownEffect(CountRow)(rows[0]).pipe(Effect.orDie, Effect.map((r) => r.n))
  })

  const countMembers = (): Command<number> => ({
    statement: Effect.sync(() => sql`SELECT COUNT(*) AS n FROM "identities" WHERE role = 'member'`),
    decode: (rows) => Schema.decodeUnknownEffect(CountRow)(rows[0]).pipe(Effect.orDie, Effect.map((r) => r.n))
  })

  const listAccounts = (): Command<ReadonlyArray<MemberView>> => ({
    statement: Effect.sync(() => sql`
      SELECT u.id AS id, i.username AS username, i.role AS role, u.createdAt AS createdAt
      FROM users AS u JOIN "identities" AS i ON i.id = u.id
      ORDER BY u.createdAt ASC
    `),
    decode: (rows) => Schema.decodeUnknownEffect(Schema.Array(MemberView))(rows).pipe(Effect.orDie)
  })

  const findMember = (id: string): Command<Option.Option<MemberView>> => ({
    statement: Effect.sync(() => sql`
      SELECT u.id AS id, i.username AS username, i.role AS role, u.createdAt AS createdAt
      FROM users AS u JOIN "identities" AS i ON i.id = u.id
      WHERE u.id = ${id} AND i.role = 'member'
    `),
    decode: (rows) =>
      rows.length === 0
        ? Effect.succeed(Option.none())
        : Schema.decodeUnknownEffect(MemberView)(rows[0]).pipe(Effect.orDie, Effect.map(Option.some))
  })

  const usernameOf = (id: string): Command<Option.Option<string>> => ({
    statement: Effect.sync(() => sql`SELECT username FROM "identities" WHERE id = ${id}`),
    decode: (rows) =>
      rows.length === 0
        ? Effect.succeed(Option.none())
        : Schema.decodeUnknownEffect(Schema.Struct({ username: Schema.String }))(rows[0]).pipe(
            Effect.orDie,
            Effect.map((r) => Option.some(r.username))
          )
  })

  // Deterministic "is this username taken" pre-check for member provisioning (a clean 409 before the
  // signUpEmail call; the UNIQUE constraint on identities.username is the backstop for the rare race).
  const usernameExists = (username: string): Command<boolean> => ({
    statement: Effect.sync(() => sql`SELECT 1 AS x FROM "identities" WHERE username = ${username} LIMIT 1`),
    decode: (rows) => Effect.succeed(rows.length > 0)
  })

  return {
    provision,
    delete: del,
    countHosts,
    countMembers,
    listAccounts,
    findMember,
    usernameOf,
    usernameExists
  } as const
})

export interface UsersRepo extends Effect.Success<typeof make> {}
export const UsersRepo = Context.Service<UsersRepo>("app/users/UsersRepo")
export const UsersRepoLayer = Layer.effect(UsersRepo, make)
