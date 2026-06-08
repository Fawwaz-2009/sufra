import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder"
import { api } from "../contract/api.ts"
import { User } from "../domain/user.ts"

/** The current-account controller — one thin line per action, delegating to the User aggregate. */
export const MeControllerLive = HttpApiBuilder.group(api, "me", (handlers) =>
  handlers.handle("show", () => User.show())
)
