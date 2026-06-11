import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder"
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse"
import * as HttpApiError from "effect/unstable/httpapi/HttpApiError"
import { api } from "../../contract/api.ts"
import { Meal } from "../../domain/meal.ts"
import { CurrentMeal } from "../../contract/middleware/meal-scoped.ts"

/**
 * The photo proxy — the framework-edge case (a binary response, not JSON). The meal is already
 * owner-scoped by `MealScoped` (404 on a non-owner), so this just reads the slot's bytes + per-meal
 * content type and returns a raw `HttpServerResponse` with a long immutable private cache header. A
 * handler may return a custom `HttpServerResponse` in place of the success value (ADR 0014).
 */
export const PhotoControllerLive = HttpApiBuilder.group(api, "photo", (handlers) =>
  handlers
    .handle("show", () =>
      Effect.gen(function* () {
        const meal = yield* CurrentMeal
        const photo = yield* Meal.photo.read(meal.id)
        if (Option.isNone(photo)) return yield* new HttpApiError.NotFound()
        return HttpServerResponse.uint8Array(photo.value.bytes, {
          contentType: photo.value.contentType,
          headers: { "cache-control": "private, max-age=31536000, immutable" }
        })
      })
    )
    // Add/replace the slot — NEVER re-estimates (ADR 0019); 204, the client re-reads by invalidation.
    .handle("create", ({ payload }) => Meal.attachPhoto(payload))
)
