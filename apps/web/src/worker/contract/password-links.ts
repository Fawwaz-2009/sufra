import * as Schema from "effect/Schema"
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup"
import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint"
import * as HttpApiError from "effect/unstable/httpapi/HttpApiError"
import { PasswordLinkShowView } from "../views/password-link.ts"
import { OkView } from "../views/setup.ts"

/** Redeem payload — the new password the Member chooses (6+, matching Setup). */
export const RedeemPassword = Schema.Struct({
  password: Schema.String.check(Schema.isMinLength(6))
})

/**
 * Password links — the PUBLIC, token-addressed redemption surface (ADR 0016). Possession of the token IS
 * the credential, so these are unauth (on `publicApi`). `show` (`GET /password-links/:token`) validates
 * the token and returns who it's for + the family name, for the set-password page (404 on an invalid or
 * expired token — uniform, no existence leak, ADR 0013); `create` (`POST /password-links/:token/password`)
 * sets the password, consumes the link, and signs the Member in (a raw response carrying the session
 * cookie). `POST .../password` reads as "create the credential under this link" — the link carries no
 * password field to PUT (ADR 0016). Issuance is the SEPARATE host-only `password-link` sub-resource.
 */
export const PasswordLinksGroup = HttpApiGroup.make("passwordLinks")
  .add(
    HttpApiEndpoint.get("show", "/password-links/:token", {
      params: Schema.Struct({ token: Schema.String }),
      success: PasswordLinkShowView,
      error: HttpApiError.NotFound
    })
  )
  .add(
    HttpApiEndpoint.post("create", "/password-links/:token/password", {
      params: Schema.Struct({ token: Schema.String }),
      payload: RedeemPassword,
      success: OkView,
      error: HttpApiError.NotFound
    })
  )
