import { queryOptions } from "@tanstack/react-query"
import * as Effect from "effect/Effect"

import { getClient, run } from "@/client/api-client"
import type { MealView } from "@/worker/views/meal"

// Cache key for this Meal's detail query. Exported so other routes (the Day view after an Override save)
// can invalidate without reconstructing the key string locally — see ADR 0006 (co-located queries).
export const mealDetailKey = (id: string) => ["meal", id] as const

export function mealQueryOptions(id: string) {
  return queryOptions({
    queryKey: mealDetailKey(id),
    queryFn: async (): Promise<MealView | null> => {
      const client = await getClient()
      // A scoped 404 is the typed `NotFound` error → map it to null (the loader turns null into a
      // notFound() route state). Any other failure propagates to the error boundary.
      return run(client.meals.show({ params: { id } }).pipe(Effect.catchTag("NotFound", () => Effect.succeed(null))))
    },
  })
}
