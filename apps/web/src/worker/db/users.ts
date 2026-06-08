import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { User } from "../models/user.ts"
import { makeTable } from "./table.ts"
import { command, type Command } from "./sql.ts"

/**
 * The users repository — app-owned rows keyed ONE-TO-ONE by the Better Auth identity id (the `id`
 * column IS that id, a shared primary key). Identity (username/role) stays in `identities` and is
 * read live by the auth session; it is never mirrored as an app column.
 *
 *  - `provision` — idempotent insert of the app row for a new identity (the sign-up hook).
 *
 * (findById + the joined profile read arrive with the Member aggregate slice.)
 */
const make = Effect.gen(function* () {
  const { sql } = yield* makeTable(User, "users")

  // Idempotent — INSERT OR IGNORE on the shared id — so a hook re-fire or retry can't double-insert
  // or fail the sign-up. The row is thin (just the anchor id + timestamps) in this slice.
  const provision = (input: { readonly id: string; readonly now: string }): Command<void> =>
    command(
      () => sql`
        INSERT OR IGNORE INTO users (id, createdAt, updatedAt)
        VALUES (${input.id}, ${input.now}, ${input.now})
      `
    )

  return { provision } as const
})

export interface UsersRepo extends Effect.Success<typeof make> {}
export const UsersRepo = Context.Service<UsersRepo>("app/users/UsersRepo")
export const UsersRepoLayer = Layer.effect(UsersRepo, make)
