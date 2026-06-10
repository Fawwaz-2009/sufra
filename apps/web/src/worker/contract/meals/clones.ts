import * as Schema from "effect/Schema"
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup"
import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint"
import * as HttpApiError from "effect/unstable/httpapi/HttpApiError"
import * as HttpApiSchema from "effect/unstable/httpapi/HttpApiSchema"
import { MealView } from "../../views/meal.ts"
import { MealScoped } from "../middleware/meal-scoped.ts"

/** Clone input — an optional `capturedAt` so a re-log lands on the SELECTED Day (defaults to now). */
export const CloneInput = Schema.Struct({
  capturedAt: Schema.optional(Schema.String)
})

/**
 * Clones — a PLURAL, create-only sub-resource (ADR 0012's cardinality discriminator: clone mints a NEW
 * retained Meal that graduates to `/meals`). `POST` → `Meal.clone`, which copies the source's Estimate +
 * override + photo bytes into a fresh, independent Meal (ADR 0008) — never inheriting `savedAt`. Returns
 * 201 + the new Meal.
 */
export const ClonesGroup = HttpApiGroup.make("clones")
  .add(
    HttpApiEndpoint.post("create", "/meals/:id/clones", {
      params: Schema.Struct({ id: Schema.String }),
      payload: CloneInput,
      success: MealView.pipe(HttpApiSchema.status(201)),
      error: HttpApiError.NotFound
    })
  )
  .middleware(MealScoped)
