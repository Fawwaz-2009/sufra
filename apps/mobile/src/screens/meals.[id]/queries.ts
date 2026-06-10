import { queryOptions } from '@tanstack/react-query';
import * as Effect from 'effect/Effect';

import { getClient, run } from '@/client/api-client';
import type { MealView } from '@sufra-web/worker/views/meal.ts';

export const mealDetailKey = (id: string) => ['meal', id] as const;

export function mealQueryOptions(id: string) {
  return queryOptions({
    queryKey: mealDetailKey(id),
    queryFn: async (): Promise<MealView | null> => {
      const client = await getClient();
      // A scoped 404 → null (the screen shows a "not found" state). Any other failure propagates.
      return run(
        client.meals
          .show({ params: { id } })
          .pipe(Effect.catchTag('NotFound', () => Effect.succeed(null)))
      );
    },
  });
}
