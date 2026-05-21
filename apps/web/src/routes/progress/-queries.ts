import { queryOptions } from "@tanstack/react-query"

import { api } from "@/lib/api"
import {
  caloriePeriodRange,
  calorieBucketFor,
  weightPeriodRange,
  type CaloriePeriod,
  type WeightPeriod,
} from "./-search"

// Exported cache keys for cross-route invalidation (e.g. the LogWeightSheet
// invalidates ["weights"] and ["calorie-history"] after a successful log).
export const weightsKey = (p: WeightPeriod) => ["weights", p] as const
export const calorieHistoryKey = (p: CaloriePeriod) =>
  ["calorie-history", p] as const

export function weightsQueryOptions(period: WeightPeriod) {
  return queryOptions({
    queryKey: weightsKey(period),
    queryFn: async () => {
      const { from, to } = weightPeriodRange(period)
      const res = await api.api.weights.$get({ query: { from, to } })
      if (!res.ok) throw new Error("failed_to_load_weights")
      const json = await res.json()
      if ("error" in json) throw new Error(json.error)
      return json
    },
  })
}

export function calorieHistoryQueryOptions(period: CaloriePeriod) {
  return queryOptions({
    queryKey: calorieHistoryKey(period),
    queryFn: async () => {
      const { from, to } = caloriePeriodRange(period)
      const bucket = calorieBucketFor(period)
      const tz =
        typeof Intl !== "undefined"
          ? Intl.DateTimeFormat().resolvedOptions().timeZone
          : "UTC"
      const res = await api.api["calorie-history"].$get({
        query: { from, to, bucket, tz },
      })
      if (!res.ok) throw new Error("failed_to_load_calorie_history")
      const json = await res.json()
      if ("error" in json) throw new Error(json.error)
      return json
    },
  })
}
