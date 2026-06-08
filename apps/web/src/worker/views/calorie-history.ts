import * as Schema from "effect/Schema"

/**
 * The bucket granularities the Progress Calories card requests (CONTEXT "Progress"). Browser-safe: the
 * contract validates `bucket` against this set, and the frontend's period→bucket map uses the same one.
 */
export const CALORIE_BUCKETS = ["day", "week", "month"] as const
export type CalorieBucket = (typeof CALORIE_BUCKETS)[number]

/** The per-bucket adherence color (CONTEXT "Progress"): green ≤ Target, yellow 0–15% over, red > 15% over
 *  — the same thresholds as the Day view's week strip. `null` when the bucket has no logged day (empty bar). */
export const BucketColor = Schema.NullOr(Schema.Literals(["ok", "warn", "over"]))

/**
 * One bar on the Progress Calories chart — a pre-bucketed, per-period rollup (the ADR 0011 read-model).
 * The server does the TZ-bucketing + historical-Target derivation (`snapshotFor` + `deriveProfile`), so the
 * chart renders colored bars without re-deriving anything. Plain JSON.
 *
 *  - `bucketStart`  — the bucket's start local date (YYYY-MM-DD): the day itself / that week's Monday / the 1st.
 *  - `kcalAvg`      — avg daily kcal over the days WITH data (NOT ÷ daysInBucket — that understates a
 *    partially-logged bucket for a fresh Member).
 *  - `targetAvg`    — avg daily Target across all days in the bucket (per-day `snapshotFor`, honoring the
 *    ADR 0002 seal).
 *  - `color`        — adherence vs Target; `null` when the bucket is empty.
 *  - `daysWithData` — days with ≥1 logged Meal (the client dims empty buckets).
 */
export const CalorieHistoryBucketView = Schema.Struct({
  bucketStart: Schema.String,
  kcalAvg: Schema.Number,
  targetAvg: Schema.Number,
  color: BucketColor,
  daysWithData: Schema.Number
})
export type CalorieHistoryBucketView = typeof CalorieHistoryBucketView.Type
export type CalorieHistoryBucketViewEncoded = typeof CalorieHistoryBucketView.Encoded
