import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as HttpApiError from "effect/unstable/httpapi/HttpApiError"
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest"
import { makeRequestAuth } from "../auth/instance.ts"
import { Authentication, CurrentUser } from "../contract/middleware/authentication.ts"
import type { Bindings } from "../env.ts"

/**
 * The Authentication middleware IMPLEMENTATION — the bridge from Better Auth's session to
 * Effect's typed `CurrentUser`. Read the request, ask Better Auth for the session, fail
 * `Unauthorized` if there is none, otherwise provide `{ id, username, role }`. From here down the
 * app never touches Better Auth again. A session-read failure is infra → defect (`Effect.orDie`).
 *
 * Better Auth is built FRESH per request (`makeRequestAuth(env)`), NOT captured as an isolate singleton.
 * Better Auth binds its `$context` (the Kysely-D1 adapter) to the request that first uses it, so a cached
 * instance reused across requests deadlocks on Cloudflare (the `$context` promise never resolves — the
 * symptom was the app hanging on skeleton loaders). Building inside the per-request effect keeps each
 * `getSession`'s D1 I/O inside one request's lifetime. (A plain factory call, not an Effect service, so
 * `Auth` never leaks into the middleware's context — `HttpApiMiddleware` forbids residual requirements.)
 */
export const AuthenticationLive = (env: Bindings) =>
  Layer.effect(
    Authentication,
    Effect.succeed((httpEffect, _options) =>
      Effect.gen(function* () {
        const auth = makeRequestAuth(env)
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
    )
  )
