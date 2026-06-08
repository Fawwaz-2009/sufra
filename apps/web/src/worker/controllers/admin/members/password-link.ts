import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder"
import { api } from "../../../contract/api.ts"
import { PasswordLink } from "../../../domain/password-link.ts"

/** The member's Password link — host-only issuance (`create` = issue/regenerate), thin → the PasswordLink
 *  aggregate. The HostOnly gate + the `:id` path live on the group's contract. */
export const MemberPasswordLinkControllerLive = HttpApiBuilder.group(api, "memberPasswordLink", (handlers) =>
  handlers.handle("create", ({ params }) => PasswordLink.issue({ memberId: params.id }))
)
