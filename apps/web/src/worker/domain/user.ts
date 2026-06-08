import * as Effect from "effect/Effect"
import * as Clock from "effect/Clock"
import { UsersRepo } from "../db/users.ts"
import { run } from "../db/sql.ts"
import { CurrentUser } from "../contract/middleware/authentication.ts"
import type { UserView } from "../views/user.ts"

const nowIso = Effect.map(Clock.currentTimeMillis, (ms) => new Date(ms).toISOString())

// The current account, projected from the session identity. The `users` row is provisioned at
// sign-up (so it exists), but in this slice it carries nothing beyond the anchor id — username +
// role come from CurrentUser. Later slices read the row to compose the resolved profile.
const show = Effect.fn("User.show")(function* () {
  const { id, username, role } = yield* CurrentUser
  return { id, username, role } satisfies UserView
})

// Provision the app row for a freshly created identity. Called by the Better Auth user.create.after
// hook OUTSIDE a request, so it takes the id explicitly (not CurrentUser).
const provision = Effect.fn("User.provision")(function* (input: { readonly id: string }) {
  const users = yield* UsersRepo
  const now = yield* nowIso
  yield* run(users.provision({ id: input.id, now }))
})

/**
 * THE USER AGGREGATE — the account/person (the product's "Member"; Host or Member by role). Own
 * verbs composed here; consumers import `{ User }` and call `User.*`, never a repo directly. The
 * profile-snapshots + weights collections fold in with the Member aggregate slice.
 */
export const User = { show, provision } as const
