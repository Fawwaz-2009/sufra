import { ActivityIndicator, Pressable, Text, View } from 'react-native';

/** The session gate's in-between frame — session live, `/me` still loading (post-sign-in tick). */
export function GateLoading() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <ActivityIndicator />
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
      <Text className="text-lg font-semibold text-black">Couldn&apos;t reach your server</Text>
      <Text className="text-center text-sm text-zinc-500">
        Check your connection, or that your Sufra server is up.
      </Text>
      <Pressable
        onPress={onRetry}
        className="mt-2 h-12 w-40 items-center justify-center rounded-[9999px] bg-emerald-800">
        <Text className="text-base font-semibold text-white">Retry</Text>
      </Pressable>
      <Pressable onPress={onChangeServer} className="h-12 items-center justify-center px-4">
        <Text className="text-sm font-medium text-zinc-500">Change server</Text>
      </Pressable>
    </View>
  );
}
