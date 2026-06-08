import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder"
import { api } from "../contract/api.ts"
import { User } from "../domain/user.ts"

/** Profile snapshots — create-only, delegating to the Member aggregate's snapshots concern. */
export const ProfileSnapshotsControllerLive = HttpApiBuilder.group(api, "profileSnapshots", (handlers) =>
  handlers.handle("create", ({ payload }) => User.snapshots.create(payload))
)
