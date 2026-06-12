import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { useMutation } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Alert, I18nManager, Text, View } from 'react-native';
import { Pressable } from '@/components/pressable';

import { getClient, run } from '@/client/api-client';
import { getAuthClient } from '@/client/auth-client';
import { getServerUrl } from '@/client/server';
import { Palette } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { prepareMealPhoto } from '@/lib/meal-photo';
import { pickMealPhotoAsset } from '@/lib/photo-source';
import type { MealView } from '@sufra-web/worker/views/meal.ts';

/**
 * The Meal's hero photo — Worker-proxied and authed (ADR 0014). A bare fetch needs the session cookie
 * injected by hand (the same pattern MealCard uses on the Today screen).
 *
 * Also the home of add/replace (ADR 0019): a text-created Meal renders the placeholder as the Add-photo
 * target; a photo Meal gets a corner Edit chip. Both run `POST /meals/:id/photo` — a pure media swap
 * that NEVER re-estimates (the standing Estimate is untouched; the next Refinement reads the new slot).
 * The photoUrl is stable, so a replace bumps a local nonce + clears expo-image's caches to refresh.
 */
export function MealPhoto({ meal, onChanged }: { meal: MealView; onChanged: () => void }) {
  const cookie = getAuthClient().getCookie();
  const [nonce, setNonce] = useState(0);

  const attach = useMutation({
    mutationKey: ['meal', meal.id, 'photo'],
    mutationFn: async (asset: Parameters<typeof prepareMealPhoto>[0]) => {
      const photo = await prepareMealPhoto(asset);
      return run((await getClient()).photo.create({ params: { id: meal.id }, payload: { photo } }));
    },
    onSuccess: async () => {
      await Image.clearMemoryCache();
      await Image.clearDiskCache();
      setNonce((n) => n + 1);
      onChanged();
    },
    onError: (error: unknown) => {
      haptics.warning();
      const message =
        typeof (error as { message?: unknown })?.message === 'string'
          ? (error as { message: string }).message
          : t`Couldn't save that photo. Try again in a moment.`;
      Alert.alert(t`Photo not saved`, message);
    },
  });

  const pick = async () => {
    const asset = await pickMealPhotoAsset();
    if (asset) attach.mutate(asset);
  };

  if (meal.hasPhoto === false) {
    return (
      <Pressable
        onPress={() => void pick()}
        disabled={attach.isPending}
        accessibilityRole="button"
        accessibilityLabel={t`Add a photo to this meal`}
        className="items-center justify-center gap-2"
        style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 24, backgroundColor: Palette.track }}>
        {attach.isPending ? (
          <ActivityIndicator />
        ) : (
          <>
            <Image
              source={require('@/assets/images/sufra-circle.png')}
              style={{ width: 64, height: 64, opacity: 0.35 }}
            />
            <Text className="text-base font-medium text-flame-deep"><Trans>Add photo</Trans></Text>
          </>
        )}
      </Pressable>
    );
  }

  return (
    <View>
      <Image
        source={{ uri: `${getServerUrl()}${meal.photoUrl}?v=${nonce}`, headers: { Cookie: cookie } }}
        style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 24, backgroundColor: Palette.track }}
        contentFit="cover"
        transition={200}
      />
      <Pressable
        onPress={() => void pick()}
        disabled={attach.isPending}
        accessibilityRole="button"
        accessibilityLabel={t`Replace this meal's photo`}
        style={{
          position: 'absolute',
          ...(I18nManager.isRTL ? { left: 12 } : { right: 12 }),
          top: 12,
          height: 32,
          justifyContent: 'center',
          paddingHorizontal: 12,
          borderRadius: 9999,
          backgroundColor: 'rgba(255,255,255,0.92)',
        }}>
        {attach.isPending ? (
          <ActivityIndicator size="small" />
        ) : (
          <Text className="text-xs font-semibold text-ink"><Trans>Edit</Trans></Text>
        )}
      </Pressable>
    </View>
  );
}
