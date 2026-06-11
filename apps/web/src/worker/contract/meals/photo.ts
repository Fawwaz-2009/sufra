import * as Schema from "effect/Schema"
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup"
import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint"
import * as HttpApiError from "effect/unstable/httpapi/HttpApiError"
import * as HttpApiSchema from "effect/unstable/httpapi/HttpApiSchema"
import { MediaTooLarge, Upload, UnsupportedMedia } from "../upload.ts"
import { MealScoped } from "../middleware/meal-scoped.ts"

/** The attach/replace payload — the same base64-JSON `Upload` shape `POST /meals` takes. */
export const AttachPhoto = Schema.Struct({ photo: Upload })

/**
 * The photo — a reified SINGULAR sub-resource (no id, no index). `show` serves the bytes through the
 * AUTHENTICATED proxy `GET /api/meals/:id/photo` (ADR 0014): owner-scoped via `MealScoped` (404 on a
 * non-owner or missing meal), never a public/presigned URL. Binary response (`asUint8Array`); the
 * controller returns a full `HttpServerResponse` so it can set the per-meal content type + a long
 * immutable cache header.
 *
 * `create` adds/replaces the slot (ADR 0019) — a pure media swap that NEVER re-estimates: the standing
 * Estimate is untouched; the next Refinement reads the slot, so future re-runs become photo+text. 204
 * (the client re-reads by invalidation). No `destroy` in v1 (removing a meal's photo has no product story).
 */
export const PhotoGroup = HttpApiGroup.make("photo")
  .add(
    HttpApiEndpoint.get("show", "/meals/:id/photo", {
      params: Schema.Struct({ id: Schema.String }),
      success: Schema.Uint8Array.pipe(HttpApiSchema.asUint8Array()),
      error: HttpApiError.NotFound
    })
  )
  .add(
    HttpApiEndpoint.post("create", "/meals/:id/photo", {
      params: Schema.Struct({ id: Schema.String }),
      payload: AttachPhoto,
      success: HttpApiSchema.NoContent,
      error: [HttpApiError.NotFound, UnsupportedMedia, MediaTooLarge]
    })
  )
  .middleware(MealScoped)
