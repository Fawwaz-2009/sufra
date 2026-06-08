import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as HttpApiError from "effect/unstable/httpapi/HttpApiError"
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest"
import { Auth } from "../auth/instance.ts"
import { Authentication, CurrentUser } from "../contract/middleware/authentication.ts"

/**
 * The Authentication middleware IMPLEMENTATION — the bridge from Better Auth's session to
 * Effect's typed `CurrentUser`. Read the request, ask Better Auth for the session, fail
 * `Unauthorized` if there is none, otherwise provide `{ id, username, role }`. From here down the
 * app never touches Better Auth again. A session-read failure is infra → defect (`Effect.orDie`).
 */
export const AuthenticationLive = Layer.effect(
  Authentication,
  Effect.gen(function* () {
    const auth = yield* Auth
    return (httpEffect, _options) =>
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest
        // Effect's Headers is a plain record; rebuild a web Headers for Better Auth.
        const session = yield* Effect.tryPromise(() =>
          auth.api.getSession({
            headers: new Headers(request.headers as Record<string, string>)
          })
        ).pipe(Effect.orDie)

        if (session === null) {
          return yield* new HttpApiError.Unauthorized()
        }

        // username (username plugin) + role (admin plugin) ride on session.user. Defaulted
        // defensively: role defaults to "member" (the admin plugin's defaultRole).
        const user = session.user as { id: string; username?: string | null; role?: string | null }
        return yield* Effect.provideService(httpEffect, CurrentUser, {
          id: user.id,
          username: user.username ?? "",
          role: user.role ?? "member"
        })
      })
  })
)
