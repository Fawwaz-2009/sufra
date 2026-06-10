import { queryOptions } from '@tanstack/react-query';
import * as Effect from 'effect/Effect';

import { getClient, run } from '@/client/api-client';
import type { MealListItemView, MealView } from '@sufra-web/worker/views/meal.ts';

export const mealDetailKey = (id: string) => ['meal', id] as const;

/** The saved-meals list query key — matches the web convention so cross-cache invalidation is consistent. */
export const savedMealsKey = () => ['meals', 'saved'] as const;

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

/** Saved Meals list — `GET /meals?saved`. Shared by the detail screen and Settings. */
export function savedMealsQueryOptions() {
  return queryOptions({
    queryKey: savedMealsKey(),
    queryFn: async (): Promise<readonly MealListItemView[]> =>
      run((await getClient()).meals.index({ query: { saved: '' } })),
  });
}

/**
 * Saved Meal toggle — POST save / DELETE unsave (ADR 0012's singular sub-resource).
 * Returns the mutationFn so the caller can wire useMutation; invalidation keys are
 * exported so stage-2 (log-from-saved) can reuse them without re-deriving them.
 */
export const savedMealMutationFn = (mealId: string, currentlySaved: boolean) => async () => {
  const client = await getClient();
  return currentlySaved
    ? run(client.saved.destroy({ params: { id: mealId } }))
    : run(client.saved.create({ params: { id: mealId } }));
};
