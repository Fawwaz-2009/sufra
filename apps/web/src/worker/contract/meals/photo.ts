import * as Schema from "effect/Schema"
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup"
import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint"
import * as HttpApiError from "effect/unstable/httpapi/HttpApiError"
import * as HttpApiSchema from "effect/unstable/httpapi/HttpApiSchema"
import { MealScoped } from "../middleware/meal-scoped.ts"

/**
 * The photo — served through the AUTHENTICATED proxy `GET /api/meals/:id/photo` (ADR 0014): owner-scoped
 * via `MealScoped` (404 on a non-owner or missing meal), never a public/presigned URL. Binary response
 * (`asUint8Array`); the controller returns a full `HttpServerResponse` so it can set the per-meal
 * content type + a long immutable cache header. v1 carries only `show` (upload rides `POST /meals`).
 */
export const PhotoGroup = HttpApiGroup.make("photo")
  .add(
    HttpApiEndpoint.get("show", "/meals/:id/photo", {
      params: Schema.Struct({ id: Schema.String }),
      success: Schema.Uint8Array.pipe(HttpApiSchema.asUint8Array()),
      error: HttpApiError.NotFound
    })
  )
  .middleware(MealScoped)
