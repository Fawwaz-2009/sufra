import { assembleHandler } from "./runtime.ts"
import type { Bindings } from "./env.ts"

/**
 * The backend app, built ONCE per isolate: the two Effect web handlers (authed `handler` + unauth
 * `publicHandler`). Bindings are stable across requests, so the Effect app layer is constructed a single
 * time. Better Auth, by contrast, is built FRESH per request (`makeRequestAuth` — see `auth/instance.ts`):
 * it binds its `$context` (the Kysely-D1 adapter) to the request that first uses it, so a cached instance
 * deadlocks across requests on Cloudflare. So it deliberately does NOT live on this isolate-level app.
 */
let app: ReturnType<typeof assembleHandler> | undefined

export const getApp = (env: Bindings) => {
  if (app === undefined) {
    app = assembleHandler(env)
  }
  return app
}
