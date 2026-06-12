import * as Schema from "effect/Schema"
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup"
import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint"
import * as HttpApiError from "effect/unstable/httpapi/HttpApiError"
import * as HttpApiSchema from "effect/unstable/httpapi/HttpApiSchema"
import { MealListItemView, MealView } from "../views/meal.ts"
import { MediaTooLarge, Upload, UnsupportedMedia } from "./upload.ts"
import { MealScoped } from "./middleware/meal-scoped.ts"

/** Create payload (ADR 0019) — the photo (base64-JSON `Upload`) and/or the `userText` description (the
 *  Member's text, CONTEXT "User text"): AT LEAST ONE, both together feeds the vision call the extra
 *  context. Plus an optional client `capturedAt` (defaults to now server-side). NOT `Meal.jsonCreate`:
 *  a meal's columns are all server-set. */
export const CreateMeal = Schema.Struct({
  photo: Schema.optional(Upload),
  userText: Schema.optional(Schema.String.check(Schema.isMinLength(1))),
  capturedAt: Schema.optional(Schema.String),
  // The Locale (ADR 0020) — client state riding the Estimate-creating request so the AI answers in the
  // Member's language. A free string, ADDITIVE (ADR 0018): the server allowlists it (unknown → English),
  // so a future client's new locale never 400s against this backend.
  locale: Schema.optional(Schema.String)
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
    // Create ALWAYS persists the meal then appends the first Estimate (ok OR failed) — the AI failing is
    // data in the returned view (`latestStatus`/`latestErrorCode`), not an HTTP error (ADR 0017). The only
    // create-time errors are the photo-validation ones and the missing-source backstop (neither photo nor
    // userText — a client bug, the UI enforces it), raised before the meal is written.
    HttpApiEndpoint.post("create", "/meals", {
      payload: CreateMeal,
      success: MealView.pipe(HttpApiSchema.status(201)),
      error: [UnsupportedMedia, MediaTooLarge, HttpApiError.BadRequest]
    })
  )
  .add(
    HttpApiEndpoint.delete("destroy", "/meals/:id", {
      params: Schema.Struct({ id: Schema.String }),
      success: HttpApiSchema.NoContent,
      error: HttpApiError.NotFound
    }).middleware(MealScoped)
  )
