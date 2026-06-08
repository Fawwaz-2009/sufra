import * as Schema from "effect/Schema"
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup"
import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint"
import * as HttpApiError from "effect/unstable/httpapi/HttpApiError"
import { PasswordLinkIssuedView } from "../../../views/password-link.ts"
import { HostOnly } from "../../middleware/host-only.ts"

/**
 * The member's Password link — a host-only SINGULAR sub-resource (ADR 0016): exactly one live link per
 * Member, so no id and no index. `create` (`POST /admin/members/:id/password-link`) issues OR regenerates
 * the link — first-issue and reset are the SAME path (the repo upserts on `userId`, replacing any prior
 * link in place) — returning the opaque token + expiry (the one thing the Host can't compute). 404 (not
 * 403) when the target isn't a Member or the caller isn't the Host. Behind `HostOnly`. 200 (not 201): an
 * idempotent issue/regenerate, not a fresh resource each call.
 */
export const MemberPasswordLinkGroup = HttpApiGroup.make("memberPasswordLink")
  .add(
    HttpApiEndpoint.post("create", "/admin/members/:id/password-link", {
      params: Schema.Struct({ id: Schema.String }),
      success: PasswordLinkIssuedView,
      error: HttpApiError.NotFound
    })
  )
  .middleware(HostOnly)
