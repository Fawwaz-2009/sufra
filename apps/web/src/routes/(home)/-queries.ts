import { queryOptions } from "@tanstack/react-query"

import { getClient, run } from "@/client/api-client"
import { formatLocalDate, weekRange } from "@/lib/date"
import type { MealListItemView } from "@/worker/views/meal"

// Cache key for a week's meals query. Exported so cross-route invalidation (after Override / Refine in
// /meals/:id, or after meal capture) can reference the broad family without reconstructing the string.
export const weekMealsKey = (weekStartDate: Date) =>
  ["meals", "week", formatLocalDate(weekStartDate)] as const

export function weekMealsQueryOptions(weekStartDate: Date) {
  return queryOptions({
    queryKey: weekMealsKey(weekStartDate),
    queryFn: async (): Promise<ReadonlyArray<MealListItemView>> => {
      const { from, to } = weekRange(weekStartDate)
      return run((await getClient()).meals.index({ query: { from, to } }))
    },
  })
}

// The Saved Meals scope (`GET /meals?saved`). Colocated here (the Day view's "from-saved" picker is its
// only consumer in Slice 2; the Profile Saved-Meals section returns in a later slice).
export const savedMealsKey = ["meals", "saved"] as const

export function savedMealsQueryOptions() {
  return queryOptions({
    queryKey: savedMealsKey,
    queryFn: async (): Promise<ReadonlyArray<MealListItemView>> =>
      run((await getClient()).meals.index({ query: { saved: "1" } })),
  })
}
