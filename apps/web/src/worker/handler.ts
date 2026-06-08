import { getApp } from "./app.ts"
import type { Bindings } from "./env.ts"

/**
 * Handle a request IF it belongs to the backend (`/api/auth/*` → Better Auth; `/api/*` → the
 * Effect HttpApi), otherwise return `undefined` so the caller falls through to the SPA (served by
 * the ASSETS binding). This is the FE/BE seam: the worker owns its API surface; everything else is
 * the single-page app.
 */
export const serveBackend = async (
  request: Request,
  env: Bindings
): Promise<Response | undefined> => {
  const app = getApp(env)
  const url = new URL(request.url)
  if (url.pathname.startsWith("/api/auth")) return app.auth.handler(request) // Better Auth
  if (url.pathname.startsWith("/api/")) return app.handler(request) // the Effect HttpApi
  return undefined // not ours — let the SPA render
}
