import * as Effect from "effect/Effect"
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse"
import type { AuthInstance } from "../auth/instance.ts"

/**
 * Sign `username` in via Better Auth and return a raw `{ ok: true }` response carrying the session
 * Set-Cookie — the "a handler may return an HttpServerResponse instead of the success value" pattern (the
 * same one the photo serve uses). Setup and Password-link redemption both end here: each
 * creates/overwrites a credential and then logs the caller in, and the ONLY thing the response must carry
 * is the cookie (the body is a bare ack; the SPA reads state via query invalidation, never this body).
 *
 * Mechanics: `returnHeaders` hands us Better Auth's `Headers`; `getSetCookie()` returns each Set-Cookie
 * UN-combined (a comma-join would corrupt cookie values); we replay them onto a fresh web `Response` that
 * `HttpServerResponse.fromWeb` turns back into a typed response, round-tripping the cookie collection so
 * the runtime re-emits every Set-Cookie. A sign-in failure here is infra (the credential was just set) → defect.
 */
export const signInResponse = (auth: AuthInstance, username: string, password: string) =>
  Effect.gen(function* () {
    const { headers } = yield* Effect.tryPromise(() =>
      auth.api.signInUsername({ body: { username, password }, returnHeaders: true })
    ).pipe(Effect.orDie)
    const out = new Headers({ "content-type": "application/json" })
    for (const cookie of headers.getSetCookie()) out.append("set-cookie", cookie)
    return HttpServerResponse.fromWeb(new Response(JSON.stringify({ ok: true }), { status: 200, headers: out }))
  })
