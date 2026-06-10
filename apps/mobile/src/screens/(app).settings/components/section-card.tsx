import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

export function SectionCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View>
      <Text className="mb-2 text-xs font-medium uppercase text-zinc-500">{label}</Text>
      <View className="overflow-hidden rounded-xl border border-zinc-200 bg-white">{children}</View>
    </View>
  );
}

export function Row({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className="flex-row items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3">
      <Text className="text-sm font-medium text-black">{label}</Text>
      <View className="min-w-0 flex-row items-center gap-1">
        <Text numberOfLines={1} className="text-sm text-zinc-500">
          {value}
        </Text>
        {onPress ? <Text className="text-sm text-zinc-300">›</Text> : null}
      </View>
    </Pressable>
  );
}
