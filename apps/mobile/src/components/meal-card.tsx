import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { DisplayText } from '@/components/display-text';
import { getAuthClient } from '@/client/auth-client';
import { getServerUrl } from '@/client/server';
import { Palette } from '@/constants/theme';
import type { MealListItemView } from '@sufra-web/worker/views/meal.ts';

export function MealCard({
  meal,
  onPress,
}: {
  meal: MealListItemView;
  /** Override the default navigate-to-detail behaviour. */
  onPress?: () => void;
}) {
  const router = useRouter();
  // The photo is Worker-proxied and authed; a bare <Image> fetch needs the replayed cookie by hand.
  const cookie = getAuthClient().getCookie();
  const handlePress = onPress ?? (() => router.push(`/meals/${meal.id}`));

  return (
    <Pressable
      onPress={handlePress}
      className="flex-row items-center gap-3 rounded-xl bg-card p-3">
      <Image
        source={{ uri: `${getServerUrl()}${meal.photoUrl}`, headers: { Cookie: cookie } }}
        style={{ width: 80, height: 80, borderRadius: 10, backgroundColor: Palette.sand2 }}
        contentFit="cover"
      />

      {/* flex-1 (not just min-w-0): RN's default flexShrink is 0, so without it this column
          sizes to its text and pushes the kcal column off the card edge in narrow contexts. */}
      <View className="min-w-0 flex-1 gap-1">
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          className="text-lg font-semibold text-ink">
          {meal.dishName ?? "Couldn't read this meal"}
        </Text>
        {meal.totals ? (
          <Text numberOfLines={1} className="text-sm text-ink-soft">
            {`P ${Math.round(meal.totals.proteinG)}g - C ${Math.round(
              meal.totals.carbsG
            )}g - F ${Math.round(meal.totals.fatG)}g`}
          </Text>
        ) : (
          <Text numberOfLines={1} className="text-sm text-ink-soft">
            Tap to retry the estimate
          </Text>
        )}
      </View>

      <View className="w-16 shrink-0 items-end">
        <DisplayText className="text-2xl text-ink">
          {meal.totals ? `~${Math.round(meal.totals.kcal)}` : '-'}
        </DisplayText>
        <Text className="text-sm text-ink-soft">kcal</Text>
      </View>
    </Pressable>
  );
}
