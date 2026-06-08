import * as Schema from "effect/Schema"
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup"
import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint"
import * as HttpApiError from "effect/unstable/httpapi/HttpApiError"
import * as HttpApiSchema from "effect/unstable/httpapi/HttpApiSchema"
import { LocalDate, WeightKg, WeightUnit } from "../models/profile-snapshot.ts"
import { WeightView } from "../views/weight.ts"

/** The Day-range query for the Progress chart — `[from, to)` UTC ISO instants (same shape as meals). */
const WeightsQuery = Schema.Struct({
  from: Schema.String,
  to: Schema.String
})

/**
 * Log-a-Weight payload: the measurement, the unit the Member was typing in (kept in sync on the
 * snapshot), and `effectiveFrom` — the client's local tomorrow, so the plan updates from tomorrow on
 * while today stays sealed (ADR 0002/0007). `weightKg` and the snapshot upsert are written atomically
 * by `User.weights.log`.
 */
const LogWeight = Schema.Struct({
  weightKg: WeightKg,
  displayWeightUnit: Schema.optional(WeightUnit),
  effectiveFrom: LocalDate
})

/**
 * Weights — the Member's measurement records (CONTEXT "Weight"; ADR 0007, user-correctable), user-
 * scoped. `GET` (range, the Progress chart), `POST` (the atomic dual-append), `DELETE /:id` (tap-a-dot;
 * 404 on a foreign/absent id — load-is-authorizing, ADR 0013). No update — a Weight is immutable; a
 * correction is delete + re-log.
 */
export const WeightsGroup = HttpApiGroup.make("weights")
  .add(
    HttpApiEndpoint.get("index", "/weights", {
      query: WeightsQuery,
      success: Schema.Array(WeightView)
    })
  )
  .add(
    HttpApiEndpoint.post("create", "/weights", {
      payload: LogWeight,
      success: WeightView.pipe(HttpApiSchema.status(201)),
      error: HttpApiError.NotFound
    })
  )
  .add(
    HttpApiEndpoint.delete("destroy", "/weights/:id", {
      params: Schema.Struct({ id: Schema.String }),
      success: HttpApiSchema.NoContent,
      error: HttpApiError.NotFound
    })
  )
