import { serveBackend } from "./worker/handler.ts"
import { MAX_REQUEST_BYTES } from "./worker/config.ts"
import type { Bindings } from "./worker/env.ts"

/** Methods that carry a body we size-gate. Reads (GET/HEAD/etc.) are never gated. */
const WRITE_METHODS = new Set(["POST", "PUT", "PATCH"])

/**
 * The single Worker entry — a thin composer. The backend handles its own routes (`/api/auth/*`,
 * `/api/*`) and returns a Response; anything it doesn't claim falls through to the ASSETS binding,
 * which serves the built SPA (with `not_found_handling: single-page-application` doing the client
 * routing fallback). One Worker, both halves — no SSR (ADR 0015).
 */
export default {
  async fetch(request: Request, env: Bindings): Promise<Response> {
    // Global pre-decode size guard: reject an oversized WRITE from its Content-Length before the
    // body is ever read. One coarse ceiling for every write (per-upload caps live in the domain).
    if (WRITE_METHODS.has(request.method)) {
      const declared = Number(request.headers.get("content-length"))
      if (Number.isFinite(declared) && declared > MAX_REQUEST_BYTES) {
        return new Response("payload too large", { status: 413 })
      }
    }

    const backendResponse = await serveBackend(request, env)
    return backendResponse ?? env.ASSETS.fetch(request)
  }
} satisfies ExportedHandler<Bindings>
