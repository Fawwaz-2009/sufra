// Calorie-history domain schemas + types. Single source of truth for the
// derived view exposed at GET /api/calorie-history. Distinct from /api/meals:
// meals returns the raw per-meal log; calorie-history returns pre-bucketed,
// per-period averages with the historical Target attached so the Progress
// chart can render colored bars without re-deriving anything.

import { z } from "zod"

export const BUCKETS = ["day", "week", "month"] as const
export type CalorieHistoryBucket = (typeof BUCKETS)[number]

export const calorieHistoryRangeSchema = z
  .object({
    from: z.iso.datetime(),
    to: z.iso.datetime(),
    bucket: z.enum(BUCKETS),
    // IANA timezone identifier. Used server-side to bucket meals into local
    // days before rolling up to week/month. Required because Day boundaries
    // are a Member-TZ concept (CONTEXT.md "Day"); a Tokyo Member's "today"
    // is different from a NYC Member's "today" even at the same UTC instant.
    tz: z.string().min(1),
  })
  .refine(({ from, to }) => Date.parse(to) > Date.parse(from), "invalid_range")

export type CalorieHistoryRangeInput = z.infer<typeof calorieHistoryRangeSchema>

// One bar on the Progress chart's Calories card.
//
// `bucketStart` — the bucket's starting local date (YYYY-MM-DD). For
//   bucket=day this is the day itself; for week it's that week's Monday; for
//   month it's the first of the month.
// `kcalAvg` — average daily kcal in the bucket, computed as
//   `sum(kcal across days with data) / countDaysWithData`. NOT divided by
//   `daysInBucket` — that would understate intake for a fresh Member who
//   hasn't logged a full bucket yet.
// `targetAvg` — average daily Target across all days in the bucket (uses
//   `snapshotFor` per day, so it respects ADR 0002's seal).
// `color` — adherence-against-target classification: green ≤target,
//   yellow 0–15% over, red >15% over. Same thresholds as the Day view's
//   week strip. `null` when `daysWithData === 0` (bar is empty).
// `daysWithData` — count of days in this bucket with at least one logged
//   Meal. Used by the client to render empty buckets dimly.
export type CalorieHistoryBucketItem = {
  bucketStart: string
  kcalAvg: number
  targetAvg: number
  color: "ok" | "warn" | "over" | null
  daysWithData: number
}
