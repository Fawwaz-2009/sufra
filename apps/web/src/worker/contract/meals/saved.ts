import * as Schema from "effect/Schema"
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup"
import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint"
import * as HttpApiError from "effect/unstable/httpapi/HttpApiError"
import * as HttpApiSchema from "effect/unstable/httpapi/HttpApiSchema"
import { MealScoped } from "../middleware/meal-scoped.ts"

/**
 * Saved — a SINGULAR toggle sub-resource over one boolean-ish state (CONTEXT "Saved Meal"; ADR 0008 +
 * 0012). `POST` save / `DELETE` unsave → `Meal.save` / `.unsave`, 204 both. The saved LIST is the scope
 * `GET /meals?saved`, not an endpoint here.
 */
export const SavedGroup = HttpApiGroup.make("saved")
  .add(
    HttpApiEndpoint.post("create", "/meals/:id/saved", {
      params: Schema.Struct({ id: Schema.String }),
      success: HttpApiSchema.NoContent,
      error: HttpApiError.NotFound
    })
  )
  .add(
    HttpApiEndpoint.delete("destroy", "/meals/:id/saved", {
      params: Schema.Struct({ id: Schema.String }),
      success: HttpApiSchema.NoContent,
      error: HttpApiError.NotFound
    })
  )
  .middleware(MealScoped)
