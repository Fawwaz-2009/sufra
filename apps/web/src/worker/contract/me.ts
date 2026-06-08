import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup"
import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint"
import { UserView } from "../views/user.ts"

/**
 * The current account — a per-session SINGLETON (no id; the record is whoever `CurrentUser` is).
 * `show` only: the account has no member-editable fields in v1 (username is fixed, role is
 * Host-set, password is an auth action). The profile/plan is its own resource (a later slice).
 */
export const MeGroup = HttpApiGroup.make("me").add(
  HttpApiEndpoint.get("show", "/me", { success: UserView })
)
