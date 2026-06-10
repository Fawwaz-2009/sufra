import * as Effect from "effect/Effect"
import * as Clock from "effect/Clock"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { ProfileSnapshotsRepo } from "../../db/profile-snapshots.ts"
import { WeightsRepo } from "../../db/weights.ts"
import { atomically, run } from "../../db/sql.ts"
import { CurrentUser } from "../../contract/middleware/authentication.ts"
import { ProfileSnapshot } from "../../models/profile-snapshot.ts"
import { Weight } from "../../models/weight.ts"
import { toProfileSnapshotView } from "../../views/profile-snapshot.ts"

const nowIso = Effect.map(Clock.currentTimeMillis, (ms) => new Date(ms).toISOString())

/**
 * Snapshots — the Member's append-only Profile history (CONTEXT "Profile snapshot"; ADR 0001/0011). One
 * create verb, create-only (the collection is sealed — an "edit" is an append of a complete immutable
 * snapshot, never a mutation). The whole seal rule lives HERE, once:
 *
 *  - FIRST snapshot = onboarding: applies same-day (the client sends `effectiveFrom = today`) and seeds
 *    the first Weight measurement, in one atomic batch (ADR 0011 — no partial-failure window).
 *  - SUBSEQUENT = an edit: applies effective tomorrow (the client sends `effectiveFrom = tomorrow`, so
 *    today's plan stays sealed — ADR 0002); the repo's ON CONFLICT (userId, effectiveFrom) handles
 *    "edited twice the same day" by overwriting the pending row in place.
 *
 * `weightKg` flows ONLY through `POST /weights` (ADR 0007): on an edit it is pinned to the latest
 * snapshot's weight, NEVER the payload — the client sends a complete snapshot but a weight change there
 * is ignored. Onboarding is the bootstrap, so it honors the payload weight (and seeds it as the first
 * measurement).
 */
export const create = Effect.fn("User.snapshots.create")(function* (
  input: typeof ProfileSnapshot.jsonCreate.Type
) {
  const { id: userId } = yield* CurrentUser
  const snapshots = yield* ProfileSnapshotsRepo
  const weights = yield* WeightsRepo

  const existing = yield* run(snapshots.latest({ userId }))
  const onboarding = Option.isNone(existing)
  const weightKg = onboarding ? input.weightKg : existing.value.weightKg

  const snapRow = Schema.encodeSync(ProfileSnapshot.insert)(
    ProfileSnapshot.insert.make({ ...input, userId, weightKg })
  )

  if (onboarding) {
    const now = yield* nowIso
    const weightRow = Schema.encodeSync(Weight.insert)(Weight.insert.make({ userId, weightKg, loggedAt: now }))
    yield* atomically([snapshots.upsert(snapRow), weights.insert(weightRow)])
    // The first row never conflicts, so the minted id IS the inserted id — serialize the built row
    // (the batch returns no rows by design).
    return toProfileSnapshotView(Schema.decodeUnknownSync(ProfileSnapshot.select)(snapRow))
  }

  // Edit: a single upsert; RETURNING * hands back the resolved row (keeping the existing id on a
  // same-day overwrite).
  const saved = yield* run(snapshots.upsert(snapRow))
  return toProfileSnapshotView(saved)
})
