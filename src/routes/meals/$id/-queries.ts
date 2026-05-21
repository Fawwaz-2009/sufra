import { queryOptions } from "@tanstack/react-query"

import { api } from "@/lib/api"
import type { MealDetail } from "../../../../worker/meals/schema"

// Cache key for this Meal's detail query. Exported so other routes (e.g. the
// Day view's optimistic update after an Override save) can invalidate without
// reconstructing the key string locally — see ADR 0006 (co-located queries).
export const mealDetailKey = (id: string) => ["meal", id] as const

export function mealQueryOptions(id: string) {
  return queryOptions({
    queryKey: mealDetailKey(id),
    queryFn: async (): Promise<MealDetail | null> => {
      const res = await api.api.meals[":id"].$get({ param: { id } })
      if (res.status === 404) return null
      if (!res.ok) throw new Error("failed_to_load_meal")
      return (await res.json()) as MealDetail
    },
  })
}
