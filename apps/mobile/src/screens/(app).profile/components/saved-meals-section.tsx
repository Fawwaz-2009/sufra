import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Text, View } from 'react-native';

import { MealCard } from '@/components/meal-card';
import { savedMealsQueryOptions } from '@/screens/meals.[id]/queries';

/**
 * SAVED MEALS section — lists each Saved Meal as a MealCard (default onPress → detail).
 * Positioned last on the Profile screen, like web.
 */
export function SavedMealsSection() {
  const savedQuery = useQuery(savedMealsQueryOptions());
  const meals = savedQuery.data ?? [];

  return (
    <View>
      <Text className="mb-2 text-xs font-medium uppercase text-zinc-500">Saved Meals</Text>

      {savedQuery.isLoading ? (
        <View className="items-center rounded-xl border border-zinc-200 bg-white py-6">
          <ActivityIndicator />
        </View>
      ) : meals.length === 0 ? (
        <View className="items-center rounded-xl border border-zinc-200 bg-white px-6 py-6">
          <Text className="text-sm font-medium text-black">No saved meals yet</Text>
          <Text className="mt-1 text-center text-sm text-zinc-500">
            Tap Save on any meal to save it for quick re-logging.
          </Text>
        </View>
      ) : (
        <View className="gap-3">
          {meals.map((m) => (
            <MealCard key={m.id} meal={m} />
          ))}
        </View>
      )}
    </View>
  );
}
