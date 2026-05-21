import { queryOptions } from "@tanstack/react-query"

import { api } from "@/lib/api"
import type { MealListItem } from "../../../worker/meals/schema"

// Saved Meals list query — used by the Profile "Saved Meals" section and by
// the Day view's "From saved" picker sheet (see ADR 0008). Profile owns this
// surface conceptually; Day view imports from here.
export const savedMealsKey = () => ["meals", "saved"] as const

export function savedMealsQueryOptions() {
  return queryOptions({
    queryKey: savedMealsKey(),
    queryFn: async (): Promise<MealListItem[]> => {
      const res = await api.api.meals.saved.$get()
      if (!res.ok) throw new Error("failed_to_load_saved_meals")
      const json = await res.json()
      return json.meals
    },
  })
}
