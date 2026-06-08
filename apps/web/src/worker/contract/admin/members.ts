import * as Schema from "effect/Schema"
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup"
import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint"
import * as HttpApiError from "effect/unstable/httpapi/HttpApiError"
import * as HttpApiSchema from "effect/unstable/httpapi/HttpApiSchema"
import { MemberView } from "../../views/member.ts"
import { HostOnly } from "../middleware/host-only.ts"

/** Provision-a-Member payload — just the username (3+ word-chars). No password: the Member sets one via a
 *  Password link (the account is created with an unreachable placeholder until then). */
export const CreateMember = Schema.Struct({
  username: Schema.String.check(Schema.isMinLength(3), Schema.isPattern(/^[a-zA-Z0-9_]+$/))
})

/** A user-facing member-create failure — the username is already taken. */
export class UsernameTaken extends Schema.TaggedErrorClass<UsernameTaken>()(
  "UsernameTaken",
  { message: Schema.String },
  { httpApiStatus: 409 }
) {}

/**
 * Admin members — the Host's INSTANCE-WIDE view of the household accounts (ADR 0013: host-scoped, not
 * owner-scoped — the Host acts across all Members). Behind the `HostOnly` gate (a non-host 404s exactly as
 * a non-owner does). `index` lists Members; `create` provisions one by username — PURE: it returns the
 * Member, the Password link is issued via the SEPARATE `password-link` sub-resource (ADR 0016); `destroy`
 * deletes a Member and cascades their data (meals + photos, snapshots, weights, the link, the credential).
 * No `show`/`update` — the list is the only read, a Member has no Host-editable fields.
 */
export const MembersGroup = HttpApiGroup.make("members")
  .add(HttpApiEndpoint.get("index", "/admin/members", { success: Schema.Array(MemberView) }))
  .add(
    HttpApiEndpoint.post("create", "/admin/members", {
      payload: CreateMember,
      success: MemberView.pipe(HttpApiSchema.status(201)),
      error: UsernameTaken
    })
  )
  .add(
    HttpApiEndpoint.delete("destroy", "/admin/members/:id", {
      params: Schema.Struct({ id: Schema.String }),
      success: HttpApiSchema.NoContent,
      error: HttpApiError.NotFound
    })
  )
  .middleware(HostOnly)
