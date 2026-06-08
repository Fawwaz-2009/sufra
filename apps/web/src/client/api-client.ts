import * as Effect from "effect/Effect"
import * as ManagedRuntime from "effect/ManagedRuntime"
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient"
import * as HttpApiClient from "effect/unstable/httpapi/HttpApiClient"
import { api } from "../worker/contract/api.ts"

/**
 * The browser's typed view of the backend: an `HttpApiClient` derived from the same `api` contract the
 * server implements (no codegen, full Schema validation). This module is JUST the transport —
 * `getClient()` (the cookie-aware client) and `run()` (execute an Effect as a Promise).
 *
 * Sufra is an SPA (ADR 0015) — no SSR, so unlike the house-style reference there is NO isomorphic
 * server branch: `getClient` always resolves `window.location.origin`, and the session cookie rides
 * along automatically (same-origin). There is NO per-resource wrapper layer: queries/mutations are
 * written where they're USED, calling `run((await getClient()).<group>.<verb>(...))` directly.
 */
const runtime = ManagedRuntime.make(FetchHttpClient.layer)

/** The typed API client, bound to the page origin. */
export const getClient = () => runtime.runPromise(HttpApiClient.make(api, { baseUrl: window.location.origin }))

/** Execute an Effect (an API call) as a Promise — the bridge into a TanStack query/mutation fn. */
export const run = <A, E>(effect: Effect.Effect<A, E>): Promise<A> =>
  runtime.runPromise(effect as Effect.Effect<A, E, never>)
