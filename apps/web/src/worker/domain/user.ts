import * as Effect from "effect/Effect"
import * as Clock from "effect/Clock"
import { UsersRepo } from "../db/users.ts"
import { ProfileSnapshotsRepo } from "../db/profile-snapshots.ts"
import { run } from "../db/sql.ts"
import { CurrentUser } from "../contract/middleware/authentication.ts"
import { toProfileSnapshotView } from "../views/profile-snapshot.ts"
import type { MeView } from "../views/me.ts"
import * as Snapshots from "./user/snapshots.ts"
import * as Weights from "./user/weights.ts"

const nowIso = Effect.map(Clock.currentTimeMillis, (ms) => new Date(ms).toISOString())

// The current account (`GET /me`): the session identity plus the Member's Profile snapshot timeline
// (newest first) and the derived `isOnboarded` ("has ≥1 snapshot" — ADR 0001/0010). The SPA resolves
// the snapshot active for a day + derives Target/macros locally (browser-safe `views/derive.ts`), so the
// server returns the timeline rather than a single resolved snapshot (TZ-locality — ADR 0002/0003).
const show = Effect.fn("User.show")(function* () {
  const { id, username, role } = yield* CurrentUser
  const snapshots = yield* ProfileSnapshotsRepo
  const rows = yield* run(snapshots.history({ userId: id }))
  return { id, username, role, isOnboarded: rows.length > 0, profiles: rows.map(toProfileSnapshotView) } satisfies MeView
})

// Provision the app row for a freshly created identity. Called by the Better Auth user.create.after
// hook OUTSIDE a request, so it takes the id explicitly (not CurrentUser).
const provision = Effect.fn("User.provision")(function* (input: { readonly id: string }) {
  const users = yield* UsersRepo
  const now = yield* nowIso
  yield* run(users.provision({ id: input.id, now }))
})

/**
 * THE USER AGGREGATE — the account/person (the product's "Member"; Host or Member by role), the ADR 0011
 * Member aggregate rooted on `users` (code-named `User` per the settled Slice 1/2 convention). Its own
 * verbs plus the two owned collections grouped as sub-namespaces: `User.snapshots.create` (the append-
 * only Profile, seal rule + onboarding seed) and `User.weights.{index,log,remove}` (measurements + the
 * atomic dual-append). Consumers import `{ User }` and call `User.*`, never a concern directly.
 */
export const User = {
  show,
  provision,
  snapshots: Snapshots, // User.snapshots.create
  weights: Weights // User.weights.index / .log / .remove
} as const
