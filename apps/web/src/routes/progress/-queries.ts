import { queryOptions } from "@tanstack/react-query"

import { getClient, run } from "@/client/api-client"
import type { WeightView } from "@/worker/views/weight"
import type { CalorieHistoryBucketView } from "@/worker/views/calorie-history"
import {
  caloriePeriodRange,
  calorieBucketFor,
  weightPeriodRange,
  type CaloriePeriod,
  type WeightPeriod,
} from "./-search"

// Exported cache keys for cross-route invalidation (the LogWeightSheet invalidates ["weights"] and
// ["calorie-history"] after a successful log; the WeightChart invalidates ["weights"] after a delete).
export const weightsKey = (p: WeightPeriod) => ["weights", p] as const
export const calorieHistoryKey = (p: CaloriePeriod) => ["calorie-history", p] as const

export function weightsQueryOptions(period: WeightPeriod) {
  return queryOptions({
    queryKey: weightsKey(period),
    queryFn: async (): Promise<ReadonlyArray<WeightView>> => {
      const { from, to } = weightPeriodRange(period)
      return run((await getClient()).weights.index({ query: { from, to } }))
    },
  })
}

export function calorieHistoryQueryOptions(period: CaloriePeriod) {
  return queryOptions({
    queryKey: calorieHistoryKey(period),
    queryFn: async (): Promise<ReadonlyArray<CalorieHistoryBucketView>> => {
      const { from, to } = caloriePeriodRange(period)
      const bucket = calorieBucketFor(period)
      const tz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC"
      return run((await getClient()).calorieHistory.index({ query: { from, to, bucket, tz } }))
    },
  })
}
