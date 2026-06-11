/**
 * Admin vision-model selector.
 * Port of apps/web/src/routes/admin/-components/model-select.tsx
 *
 * The Host picks which OpenRouter vision model is used for Estimates. The catalog
 * is browser-safe code (VISION_MODELS); the current selection is stored in
 * app_settings and read through settingsQueryOptions.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { getClient, run } from '@/client/api-client';
import { VISION_MODELS } from '@sufra-web/worker/views/setting.ts';
import { adminSettingsKey, settingsQueryOptions } from '../queries';

export function ModelSelect() {
  const settingsQuery = useQuery(settingsQueryOptions());
  const visionModelId = settingsQuery.data?.visionModelId;
  const queryClient = useQueryClient();

  const patchSettings = useMutation({
    mutationFn: async (input: { visionModelId: string }) =>
      run((await getClient()).settings.update({ payload: input })),
    onSuccess(next) {
      queryClient.setQueryData(adminSettingsKey, next);
    },
    onError() {
      Alert.alert("Couldn't update model", 'Try again.');
    },
  });

  return (
    <View className="gap-2">
      {VISION_MODELS.map((m) => {
        const selected = visionModelId === m.id;
        const pending =
          patchSettings.isPending &&
          patchSettings.variables?.visionModelId === m.id;

        return (
          <Pressable
            key={m.id}
            disabled={patchSettings.isPending || selected}
            onPress={() => patchSettings.mutate({ visionModelId: m.id })}
            className={`flex-row items-center gap-3 rounded-xl px-4 py-3 ${selected ? 'border-2 border-flame bg-white' : 'bg-surface'}`}
          >
            <View className="min-w-0 flex-1">
              <Text numberOfLines={1} className="text-sm font-medium text-ink">
                {m.label}
              </Text>
              <Text className="mt-1 text-xs text-ink-soft">
                {`$${m.pricing.inputPerMTokens.toFixed(2)} in / $${m.pricing.outputPerMTokens.toFixed(2)} out per 1M tok`}
              </Text>
            </View>

            {pending ? (
              <ActivityIndicator size="small" />
            ) : (
              <View
                className={`h-4 w-4 rounded-[9999px] border ${selected ? 'border-flame bg-flame' : 'border-line'}`}
              />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
