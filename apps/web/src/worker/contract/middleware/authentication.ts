import * as Context from "effect/Context"
import * as HttpApiMiddleware from "effect/unstable/httpapi/HttpApiMiddleware"
import * as HttpApiError from "effect/unstable/httpapi/HttpApiError"

/**
 * The authenticated IDENTITY, as the rest of the app sees it — `id` + `username` + `role`. `id`
 * is the universal anchor (it equals `users.id` and is the value every resource references as
 * `userId`); `username` is the credential handle (no email in Sufra); `role` is `host | member`,
 * used by the Host-only admin surface as a scoping predicate (a non-host gets the same 404 as a
 * non-owner — ADR 0013). Everything else about the person lives on the domain `User`, read via
 * the aggregate. Provided by `Authentication`, consumed via `yield* CurrentUser`.
 */
export class CurrentUser extends Context.Service<
  CurrentUser,
  { readonly id: string; readonly username: string; readonly role: string }
>()("app/CurrentUser") {}

/**
 * The authentication middleware DECLARATION (browser-safe — part of the typed API). The
 * IMPLEMENTATION lives in `middleware/authentication.ts`. A "before_action": it runs before the
 * endpoint, may halt (Unauthorized), and provides `CurrentUser`.
 */
export class Authentication extends HttpApiMiddleware.Service<
  Authentication,
  { provides: CurrentUser }
>()("app/Authentication", { error: HttpApiError.Unauthorized }) {}
