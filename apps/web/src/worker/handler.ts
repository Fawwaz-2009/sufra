import { getApp } from "./app.ts"
import { environmentOf, type Bindings } from "./env.ts"

/**
 * The PUBLIC (unauth) api lives at these `/api` prefixes — the bootstrap surface (Setup) and the
 * credential handoff (Password-link redemption), neither of which can sit behind a session. Everything
 * else under `/api/` is the authed api. Matching is exact-or-child (`/api/setup`, `/api/password-links/…`)
 * so it can't shadow an authed route.
 */
const PUBLIC_API_PREFIXES = ["/api/setup", "/api/password-links"] as const

const isPublicApiPath = (pathname: string): boolean =>
  PUBLIC_API_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))

/** Credential sign-in paths Better Auth exposes — throttled per IP to defang brute-force / credential
 *  stuffing (the `LOGIN_RATE_LIMITER` Workers binding, 5/min). */
const SIGN_IN_PATHS = new Set(["/sign-in/username", "/sign-in/email"])

/**
 * Handle a request IF it belongs to the backend (`/api/auth/*` → Better Auth, with a per-IP throttle on
 * sign-in; the public bootstrap prefixes → the unauth `publicApi`; everything else `/api/*` → the authed
 * Effect HttpApi), otherwise return `undefined` so the caller falls through to the SPA (served by the
 * ASSETS binding). This is the FE/BE seam: the worker owns its API surface; everything else is the SPA.
 */
export const serveBackend = async (
  request: Request,
  env: Bindings
): Promise<Response | undefined> => {
  const app = getApp(env)
  const url = new URL(request.url)
  if (url.pathname.startsWith("/api/auth")) {
    // Throttle credential sign-in before handing off to Better Auth. `cf-connecting-ip` is always set by
    // Cloudflare in front of the Worker; missing ⇒ local dev. Skipped under ENVIRONMENT="test" — the
    // request harness signs in many times from one shared key, which a real 5/min limiter would throttle.
    if (
      environmentOf(env) !== "test" &&
      request.method === "POST" &&
      SIGN_IN_PATHS.has(url.pathname.replace(/^\/api\/auth/, ""))
    ) {
      const ip = request.headers.get("cf-connecting-ip") ?? "local-dev"
      const { success } = await env.LOGIN_RATE_LIMITER.limit({ key: ip })
      if (!success) {
        return new Response(JSON.stringify({ error: "too_many_requests" }), {
          status: 429,
          headers: { "content-type": "application/json" }
        })
      }
    }
    return app.auth.handler(request) // Better Auth
  }
  if (isPublicApiPath(url.pathname)) return app.publicHandler(request) // unauth bootstrap (Setup + redeem)
  if (url.pathname.startsWith("/api/")) return app.handler(request) // the authed Effect HttpApi
  return undefined // not ours — let the SPA render
}
