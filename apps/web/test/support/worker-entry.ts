import { serveBackend } from "../../src/worker/handler.ts"
import type { Bindings } from "../../src/worker/env.ts"

/**
 * The request pool needs a `main` Worker to bundle, but can't use the production entry
 * (src/server.ts falls through to the ASSETS binding, absent in the pool). This frontend-free entry
 * runs the same `serveBackend`. Tests call `serveBackend` directly through the harness, so they
 * don't route through this `fetch`; it exists only to give the pool a module to bundle.
 */
export default {
  async fetch(request: Request, env: Bindings): Promise<Response> {
    const backendResponse = await serveBackend(request, env)
    return backendResponse ?? new Response("not found (no frontend in test worker)", { status: 404 })
  }
} satisfies ExportedHandler<Bindings>
