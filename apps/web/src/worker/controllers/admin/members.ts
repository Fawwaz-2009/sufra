import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder"
import { api } from "../../contract/api.ts"
import { User } from "../../domain/user.ts"

/** Admin members — index / create / destroy, each one thin line to the User aggregate's members concern
 *  (host-only, instance-wide; the HostOnly gate sits on the group's contract). */
export const MembersControllerLive = HttpApiBuilder.group(api, "members", (handlers) =>
  handlers
    .handle("index", () => User.members.index())
    .handle("create", ({ payload }) => User.members.create(payload))
    .handle("destroy", ({ params }) => User.members.destroy({ id: params.id }))
)
