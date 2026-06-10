import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder"
import { publicApi } from "../contract/public-api.ts"
import { PasswordLink } from "../domain/password-link.ts"

/**
 * Password links — the PUBLIC redemption controller (on `publicApi`, no Authentication — the token IS the
 * credential). `show` validates the token + returns the set-password page data; `create` sets the
 * password, consumes the link, and returns a raw Set-Cookie response. Thin → the PasswordLink aggregate.
 */
export const PasswordLinksControllerLive = HttpApiBuilder.group(publicApi, "passwordLinks", (handlers) =>
  handlers
    .handle("show", ({ params }) => PasswordLink.show({ token: params.token }))
    .handle("create", ({ params, payload }) =>
      PasswordLink.redeem({ token: params.token, password: payload.password })
    )
)
