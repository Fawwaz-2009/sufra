import * as Schema from "effect/Schema"
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup"
import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint"
import * as HttpApiError from "effect/unstable/httpapi/HttpApiError"
import * as HttpApiSchema from "effect/unstable/httpapi/HttpApiSchema"
import { MealOverride } from "../../models/meal-analysis.ts"
import { MealScoped } from "../middleware/meal-scoped.ts"

/**
 * The Override — a SINGULAR sub-resource of the meal (CONTEXT "Override"; ADR 0012). `PUT` set /
 * `DELETE` reset → `Meal.override.set` / `.reset`. PUT-REPLACE (the whole override, absent field = not
 * overridden) is what KILLS the old null-vs-absent PATCH bug. Both 204 — the client sent the override
 * and recomputes Totals locally (`resolveTotals`), then re-reads on invalidation; nothing to return.
 */
export const OverrideGroup = HttpApiGroup.make("override")
  .add(
    HttpApiEndpoint.put("update", "/meals/:id/override", {
      params: Schema.Struct({ id: Schema.String }),
      payload: MealOverride,
      success: HttpApiSchema.NoContent,
      error: HttpApiError.NotFound
    })
  )
  .add(
    HttpApiEndpoint.delete("destroy", "/meals/:id/override", {
      params: Schema.Struct({ id: Schema.String }),
      success: HttpApiSchema.NoContent,
      error: HttpApiError.NotFound
    })
  )
  .middleware(MealScoped)
