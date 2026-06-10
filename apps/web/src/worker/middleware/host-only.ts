import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as HttpApiError from "effect/unstable/httpapi/HttpApiError"
import { HostOnly } from "../contract/middleware/host-only.ts"
import { CurrentUser } from "../contract/middleware/authentication.ts"

/**
 * HostOnly IMPLEMENTATION — read the `role` Authentication already provided; let the endpoint through when
 * it is "host", else 404 (role-as-scope, ADR 0013 — never 403; a non-host is indistinguishable from a
 * non-existent resource). A PURE gate: no repo, no per-request capture, provides nothing — it only halts.
 */
export const HostOnlyLive = Layer.effect(
  HostOnly,
  // No per-request capture (a pure gate over CurrentUser), so the construction effect yields the
  // middleware function directly — `Effect.succeed`, not an empty `Effect.gen` (which `require-yield` flags).
  Effect.succeed((httpEffect, _options) =>
    Effect.gen(function* () {
      const user = yield* CurrentUser
      if (user.role !== "host") return yield* new HttpApiError.NotFound()
      return yield* httpEffect
    })
  )
)
