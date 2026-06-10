import * as Effect from "effect/Effect"
import { Auth } from "../../auth/instance.ts"
import { UsersRepo } from "../../db/users.ts"
import { MealsRepo } from "../../db/meals.ts"
import { ProfileSnapshotsRepo } from "../../db/profile-snapshots.ts"
import { WeightsRepo } from "../../db/weights.ts"
import { PasswordLinksRepo } from "../../db/password-links.ts"
import { atomically, run } from "../../db/sql.ts"
import { Photo } from "../../models/meal.ts"
import { UsernameTaken } from "../../contract/admin/members.ts"
import { toMemberView } from "../../views/member.ts"
import { orNotFound } from "../../support/http.ts"
import * as Attachable from "../concerns/attachable.ts"

/**
 * Members — the Host's INSTANCE-WIDE admin view of the household accounts. ADR 0011 keeps ONE `users`
 * aggregate, so these are its host-facing verbs (distinct from the user-scoped `snapshots`/`weights`),
 * reached as `User.members.*`. The `HostOnly` gate (ADR 0013) sits in front; a non-host never reaches here.
 *
 *  - index   — list the Members (the credential `username` joined live from `identities`).
 *  - create  — provision a Member by username via `signUpEmail` with an UNREACHABLE placeholder password
 *    (the real one is set later via a Password link — the create stays PURE, ADR 0016). Fires the
 *    user.create.after hook (the `users` row). A taken username is a clean 409.
 *  - destroy — delete a Member and CASCADE their data (D1 has no FK cascade — every delete is explicit):
 *    purge each meal's photo (R2 blobs + attachment rows, keyed per-meal), delete the CREDENTIAL FIRST
 *    (sessions + identity + account, via the internal adapter), then ONE atomic batch deleting the app
 *    rows (meals/snapshots/weights/the link/the users row). Credential-FIRST so a partial failure can
 *    never strand an account that can still sign in — the security-sensitive half goes first; a defect
 *    after it leaves only user-scoped app rows no session can reach (the inference_run audit survives —
 *    decoupled). 404 on a non-Member/absent id (the role-scoped find IS the gate). Not cross-system
 *    atomic (Better Auth + D1 have no shared transaction) — accepted: the worst case is inaccessible
 *    leftover rows, never a live ghost account, and a re-run can't 404-recover that edge.
 */
export const index = Effect.fn("User.members.index")(function* () {
  const users = yield* UsersRepo
  return yield* run(users.listMembers())
})

export const create = Effect.fn("User.members.create")(function* (input: { readonly username: string }) {
  const auth = yield* Auth
  const users = yield* UsersRepo

  if (yield* run(users.usernameExists(input.username))) {
    return yield* new UsernameTaken({ message: "That username is taken." })
  }

  const created = yield* Effect.tryPromise(() =>
    auth.api.signUpEmail({
      body: {
        email: `${input.username}@sufra.local`,
        // An unreachable placeholder — the Member never authenticates with it; they set a real password
        // via the Password link. Better Auth requires a non-null password at sign-up.
        password: crypto.randomUUID() + crypto.randomUUID(),
        name: input.username,
        username: input.username
      }
    })
  ).pipe(Effect.orDie)

  return toMemberView({
    id: created.user.id,
    username: input.username,
    createdAt: new Date(created.user.createdAt).toISOString()
  })
})

export const destroy = Effect.fn("User.members.destroy")(function* (input: { readonly id: string }) {
  const auth = yield* Auth
  const users = yield* UsersRepo
  const meals = yield* MealsRepo
  const snapshots = yield* ProfileSnapshotsRepo
  const weights = yield* WeightsRepo
  const links = yield* PasswordLinksRepo

  yield* run(users.findMember(input.id)).pipe(orNotFound)

  // Photos are keyed per-meal, so walk the member's meal ids and purge each slot (R2 + attachment rows).
  const mealIds = yield* run(meals.idsForUser({ userId: input.id }))
  yield* Effect.forEach(mealIds, (mealId) => Attachable.purgeRecord(Photo.recordType, mealId), {
    concurrency: "unbounded"
  })

  // The credential FIRST (sessions + identity + account). The internal adapter is the server-side
  // primitive (no admin session needed). Doing this before the app rows means a partial failure can never
  // leave an account that still authenticates — the security-sensitive half is removed first.
  const ctx = yield* Effect.tryPromise(() => auth.$context).pipe(Effect.orDie)
  yield* Effect.tryPromise(() => ctx.internalAdapter.deleteSessions(input.id)).pipe(Effect.orDie)
  yield* Effect.tryPromise(() => ctx.internalAdapter.deleteUser(input.id)).pipe(Effect.orDie)

  // Then the app-owned rows atomically (no FK cascade on D1). The decoupled inference_run cost rows
  // survive (audit ground truth).
  yield* atomically([
    meals.delete({ userId: input.id }),
    snapshots.deleteForUser(input.id),
    weights.delete({ userId: input.id }),
    links.deleteForUser(input.id),
    users.delete({ id: input.id })
  ])
})
