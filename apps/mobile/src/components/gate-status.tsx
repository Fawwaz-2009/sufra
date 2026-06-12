import { Trans } from '@lingui/react/macro';
import { ActivityIndicator, Text, View } from 'react-native';
import { Pressable } from '@/components/pressable';

import { Palette } from '@/constants/theme';

/** The session gate's in-between frame — session live, `/me` still loading (post-sign-in tick). */
export function GateLoading() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <ActivityIndicator color={Palette.flame} />
    </View>
  );
}

/**
 * The session gate's dead-end frame — signed in but `/me` unreachable. Bring-your-own-backend means
 * "your server is down" is a real state (ADR 0018), so it gets a retry and a way back to Connect.
 */
export function GateError({
  onRetry,
  onChangeServer,
}: {
  onRetry: () => void;
  onChangeServer: () => void;
}) {
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-white px-6">
      <Text className="text-lg font-semibold text-ink">
        <Trans>Couldn&apos;t reach your server</Trans>
      </Text>
      <Text className="text-center text-sm text-ink-soft">
        <Trans>Check your connection, or that your Sufra server is up.</Trans>
      </Text>
      <Pressable
        onPress={onRetry}
        className="mt-2 h-12 w-40 items-center justify-center rounded-[9999px] bg-flame">
        <Text className="text-base font-semibold text-white">
          <Trans>Retry</Trans>
        </Text>
      </Pressable>
      <Pressable onPress={onChangeServer} className="h-12 items-center justify-center px-4">
        <Text className="text-sm font-medium text-flame">
          <Trans>Change server</Trans>
        </Text>
      </Pressable>
    </View>
  );
}
