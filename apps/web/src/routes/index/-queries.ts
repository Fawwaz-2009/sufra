import { queryOptions } from "@tanstack/react-query"

import { api } from "@/lib/api"
import { formatLocalDate, weekRange } from "@/lib/date"

// Cache key for a week's meals query. Exported so cross-route invalidation
// (e.g. after Override / Refine in /meals/:id, or after meal capture) can
// reference the broad family without reconstructing the string locally.
export const weekMealsKey = (weekStartDate: Date) =>
  ["meals", "week", formatLocalDate(weekStartDate)] as const

export function weekMealsQueryOptions(weekStartDate: Date) {
  return queryOptions({
    queryKey: weekMealsKey(weekStartDate),
    queryFn: async () => {
      const { from, to } = weekRange(weekStartDate)
      const res = await api.api.meals.$get({ query: { from, to } })
      if (!res.ok) throw new Error("failed_to_load_meals")
      const json = await res.json()
      if ("error" in json) throw new Error(json.error)
      return json
    },
  })
}
