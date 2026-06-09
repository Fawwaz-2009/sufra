import { Image } from 'expo-image';
import { Pressable, Text, View } from 'react-native';

import { API_URL } from '@/client/api-client';
import { authClient } from '@/client/auth-client';
import type { MealListItemView } from '@sufra-web/worker/views/meal.ts';

export function MealCard({ meal }: { meal: MealListItemView }) {
  // The photo is Worker-proxied and authed; a bare <Image> fetch needs the replayed cookie by hand.
  const cookie = authClient.getCookie();
  return (
    <Pressable className="flex-row items-center gap-3 rounded-xl bg-zinc-100 p-3">
      <Image
        source={{ uri: `${API_URL}${meal.photoUrl}`, headers: { Cookie: cookie } }}
        style={{ width: 80, height: 80, borderRadius: 10, backgroundColor: '#D4D4D8' }}
        contentFit="cover"
      />

      <View className="min-w-0 flex-1 gap-1">
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          className="text-lg font-semibold text-black">
          {meal.dishName ?? "Couldn't read this meal"}
        </Text>
        {meal.totals ? (
          <Text numberOfLines={1} className="text-sm text-zinc-600">
            {`P ${Math.round(meal.totals.proteinG)}g - C ${Math.round(
              meal.totals.carbsG
            )}g - F ${Math.round(meal.totals.fatG)}g`}
          </Text>
        ) : (
          <Text numberOfLines={1} className="text-sm text-zinc-600">
            Tap to retry the estimate
          </Text>
        )}
      </View>

      <View className="w-16 shrink-0 items-end">
        <Text className="text-2xl font-semibold text-black">
          {meal.totals ? `~${Math.round(meal.totals.kcal)}` : '-'}
        </Text>
        <Text className="text-sm text-zinc-500">kcal</Text>
      </View>
    </Pressable>
  );
}
