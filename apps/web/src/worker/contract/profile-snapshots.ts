import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup"
import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint"
import * as HttpApiSchema from "effect/unstable/httpapi/HttpApiSchema"
import { ProfileSnapshot } from "../models/profile-snapshot.ts"
import { ProfileSnapshotView } from "../views/profile-snapshot.ts"

/**
 * Profile snapshots — the append-only Profile history (ADR 0011). CREATE-ONLY, user-scoped: a Profile
 * "edit" is an APPEND of a new complete immutable snapshot, never a mutation, so there is no
 * update/show/destroy (and no `PATCH /profile` — the verb that would lie). The payload IS the model's
 * `jsonCreate` (the complete snapshot the client wants to append + `effectiveFrom`); `id`/`userId`/
 * `createdAt` are server-set. The first create is onboarding (same-day + seeds the first Weight); the
 * rest are effective-tomorrow upserts — the domain branches on "has a prior snapshot," no second
 * endpoint. The reads live on `GET /me` (the snapshot timeline + isOnboarded).
 */
export const ProfileSnapshotsGroup = HttpApiGroup.make("profileSnapshots").add(
  HttpApiEndpoint.post("create", "/profile-snapshots", {
    payload: ProfileSnapshot.jsonCreate,
    success: ProfileSnapshotView.pipe(HttpApiSchema.status(201))
  })
)
