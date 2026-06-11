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
      className="w-full overflow-hidden rounded-2xl border border-line bg-white">
      <Image
        source={{ uri: `${getServerUrl()}${meal.photoUrl}`, headers: { Cookie: cookie } }}
        style={{ width: '100%', height: 190, backgroundColor: Palette.track }}
        contentFit="cover"
      />

      <View className="px-3 pt-2 pb-3">
        {/* Name + kcal row */}
        <View className="flex-row items-baseline justify-between gap-2">
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            className="min-w-0 flex-1 text-[17px] font-semibold text-ink">
            {meal.dishName ?? "Couldn't read this meal"}
          </Text>
          <View className="shrink-0 flex-row items-baseline">
            <DisplayText className="text-[17px] text-ink">
              {meal.totals ? `~${Math.round(meal.totals.kcal)}` : '–'}
            </DisplayText>
            <Text className="text-sm text-ink-soft"> kcal</Text>
          </View>
        </View>

        {/* Macro line */}
        {meal.totals ? (
          <Text numberOfLines={1} className="text-sm text-ink-soft">
            {`P ${Math.round(meal.totals.proteinG)}g · C ${Math.round(meal.totals.carbsG)}g · F ${Math.round(meal.totals.fatG)}g`}
          </Text>
        ) : (
          <Text numberOfLines={1} className="text-sm font-medium text-flame-deep">
            Tap to retry the estimate
          </Text>
        )}
      </View>
    </Pressable>
  );
}
