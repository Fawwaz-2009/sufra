import * as Schema from "effect/Schema"
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup"
import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint"
import * as HttpApiError from "effect/unstable/httpapi/HttpApiError"
import * as HttpApiSchema from "effect/unstable/httpapi/HttpApiSchema"
import { MealListItemView, MealView } from "../views/meal.ts"
import { MediaTooLarge, Upload, UnsupportedMedia } from "./upload.ts"
import { MealScoped } from "./middleware/meal-scoped.ts"

/**
 * The synchronous-atomic create gates persistence on the estimator: nothing persists unless the
 * Estimate succeeds (CLAUDE.md "Meals lifecycle"). When it fails, the waiting Member sees this typed
 * error (a toast), declared on `create` + `refinement`. (Lives here so refinement can import it.)
 */
export class EstimateFailed extends Schema.TaggedErrorClass<EstimateFailed>()(
  "EstimateFailed",
  { message: Schema.String },
  { httpApiStatus: 502 }
) {}

/** Create payload — the photo (base64-JSON `Upload`) + an optional client `capturedAt` (defaults to
 *  now server-side). NOT `Meal.jsonCreate`: a meal's columns are all server-set. */
export const CreateMeal = Schema.Struct({
  photo: Upload,
  capturedAt: Schema.optional(Schema.String)
})

/**
 * The `index` query. `?saved` is the Saved Meals scope (ADR 0012); otherwise `?from&to` is the Day
 * range. All optional on the wire — the domain branches (saved present → saved list; else from&to
 * required, else an empty range).
 */
const MealsQuery = Schema.Struct({
  from: Schema.optional(Schema.String),
  to: Schema.optional(Schema.String),
  saved: Schema.optional(Schema.String)
})

export const MealsGroup = HttpApiGroup.make("meals")
  .add(
    HttpApiEndpoint.get("index", "/meals", {
      query: MealsQuery,
      success: Schema.Array(MealListItemView)
    })
  )
  .add(
    HttpApiEndpoint.get("show", "/meals/:id", {
      params: Schema.Struct({ id: Schema.String }),
      success: MealView,
      error: HttpApiError.NotFound
    }).middleware(MealScoped)
  )
  .add(
    HttpApiEndpoint.post("create", "/meals", {
      payload: CreateMeal,
      success: MealView.pipe(HttpApiSchema.status(201)),
      error: [EstimateFailed, UnsupportedMedia, MediaTooLarge]
    })
  )
  .add(
    HttpApiEndpoint.delete("destroy", "/meals/:id", {
      params: Schema.Struct({ id: Schema.String }),
      success: HttpApiSchema.NoContent,
      error: HttpApiError.NotFound
    }).middleware(MealScoped)
  )
