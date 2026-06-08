import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup"
import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint"
import { MeView } from "../views/me.ts"

/**
 * The current account — a per-session SINGLETON (no id; the record is whoever `CurrentUser` is).
 * `show` only: the account has no member-editable fields in v1 (username is fixed, role is Host-set,
 * password is an auth action). It returns the identity PLUS the Member's Profile snapshot timeline +
 * `isOnboarded` (ADR 0011 folds the old `GET /profile` read into `/me`); the Profile is written through
 * the separate `profile-snapshots` resource.
 */
export const MeGroup = HttpApiGroup.make("me").add(
  HttpApiEndpoint.get("show", "/me", { success: MeView })
)
