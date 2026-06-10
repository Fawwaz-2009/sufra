import * as Schema from "effect/Schema"
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup"
import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint"
import { CALORIE_BUCKETS, CalorieHistoryBucketView } from "../views/calorie-history.ts"

/** A UTC ISO instant (`YYYY-MM-DDTHH:mm:ss(.sss)?Z`, what `Date.toISOString()` emits). Validated at the
 *  boundary so a malformed `from`/`to` is a clean 400, NOT a 500 — the rollup feeds these into `new Date()`
 *  + `Intl.DateTimeFormat.format`, which THROW `RangeError` on a non-date string (unlike a SQL BETWEEN). */
const UtcInstant = Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/))

/** The Progress Calories query: a `[from, to)` UTC range + the bucket granularity + the Member's IANA TZ.
 *  Day boundaries are a Member-TZ concept (CONTEXT "Day"), so the server needs the TZ to bucket meals into
 *  local days before rolling up to week/month. */
const CalorieHistoryQuery = Schema.Struct({
  from: UtcInstant,
  to: UtcInstant,
  bucket: Schema.Literals(CALORIE_BUCKETS),
  tz: Schema.String.check(Schema.isMinLength(1))
})

/**
 * Calorie history — the Progress Calories rollup (ADR 0011 read-model), user-scoped (CurrentUser via the
 * api-wide Authentication; no resource middleware, like `/me` + `/weights`). `index`
 * (`GET /calorie-history?from&to&bucket&tz`) returns the pre-bucketed bars — avg kcal + historical Target +
 * adherence color. Distinct from `GET /meals` (the raw per-Meal log): this is the derived, per-period view
 * the chart renders without re-deriving.
 */
export const CalorieHistoryGroup = HttpApiGroup.make("calorieHistory").add(
  HttpApiEndpoint.get("index", "/calorie-history", {
    query: CalorieHistoryQuery,
    success: Schema.Array(CalorieHistoryBucketView)
  })
)
