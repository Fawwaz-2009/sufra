import * as Context from "effect/Context"
import * as Effect from "effect/Effect"

/**
 * The blob seam — the media analog of `SqlClient`: one low-level capability per verb. The R2 bucket
 * binding (`BUCKET`) IS the transport (the way D1 is the database); there is no storage-provider
 * abstraction.
 *
 * Sufra DELIBERATELY drops the house style's presigned-direct-from-R2 mode (ADR 0014): photos serve
 * through the authenticated Worker proxy `GET /api/meals/:id/photo`, never a public/signed URL. So
 * there is no `signGetUrl`, no aws4fetch, no `BlobsLive`/`BlobsLocal` env-swap, no `/files` route — the
 * single R2-binding implementation is identical in every environment.
 *
 *   put    — write bytes to R2 under `key`, tagged with the sniffed content type.
 *   get    — read the bytes back (null = absent). Used by the proxy serve, refine, and clone.
 *   delete — remove the object.
 *
 * Infra failures die as defects (`Effect.promise` has no error channel) — they are outages, not domain
 * outcomes.
 */
export interface BlobInput {
  readonly body: ArrayBuffer | Uint8Array
  readonly contentType: string
}

export class Blobs extends Context.Service<
  Blobs,
  {
    readonly put: (key: string, input: BlobInput) => Effect.Effect<void>
    readonly get: (key: string) => Effect.Effect<Uint8Array | null>
    readonly delete: (key: string) => Effect.Effect<void>
  }
>()("app/Blobs") {}
