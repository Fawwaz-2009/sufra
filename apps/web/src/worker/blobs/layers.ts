import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { Blobs, type BlobInput } from "./blobs.ts"
import type { Bindings } from "../env.ts"

/**
 * The `Blobs` transport — just the R2 binding. One implementation for every environment (miniflare
 * provisions a local `BUCKET` for dev + tests), because Sufra serves through the authenticated proxy,
 * not presigned URLs (ADR 0014) — there is nothing to swap by environment. `Blobs` is env-static (the
 * binding is stable), so it's provided directly in the runtime, like Auth and the Estimator.
 */
export const BlobsLayer = (env: Bindings): Layer.Layer<Blobs> =>
  Layer.succeed(Blobs, {
    put: (key, input: BlobInput) =>
      Effect.promise(() =>
        env.BUCKET.put(key, input.body, { httpMetadata: { contentType: input.contentType } })
      ).pipe(Effect.asVoid),
    get: (key) =>
      Effect.promise(async () => {
        const object = await env.BUCKET.get(key)
        return object === null ? null : new Uint8Array(await object.arrayBuffer())
      }),
    delete: (key) => Effect.promise(() => env.BUCKET.delete(key)).pipe(Effect.asVoid)
  })
