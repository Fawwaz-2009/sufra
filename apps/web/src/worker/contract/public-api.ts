import * as HttpApi from "effect/unstable/httpapi/HttpApi"
import { SetupGroup } from "./setup.ts"
import { PasswordLinksGroup } from "./password-links.ts"

/**
 * The PUBLIC (unauth) HTTP contract — the bootstrap + credential-handoff surface that CANNOT sit behind
 * the api-wide `Authentication` (Setup runs before any Host exists; a Password link is redeemed by someone
 * with no session — possession of the token IS the credential). A SECOND `HttpApi` mounted ALONGSIDE the
 * authed `api`, same `/api` prefix, NO middleware. The worker entry (`handler.ts`) dispatches the known
 * public path prefixes (`/api/setup`, `/api/password-links`) to this handler, everything else `/api/*` to
 * the authed one. The browser reaches it via a second typed client (`getPublicClient`). Keeping these
 * endpoints in a contract (not special-cased in the seam) preserves the typed-client window.
 */
export const publicApi = HttpApi.make("publicApi").add(SetupGroup).add(PasswordLinksGroup).prefix("/api")
