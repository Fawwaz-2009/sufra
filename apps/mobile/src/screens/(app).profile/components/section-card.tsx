import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { Pressable } from '@/components/pressable';

export function SectionCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View>
      <Text className="mb-2 text-xs font-medium uppercase text-ink-soft">{label}</Text>
      <View className="overflow-hidden rounded-xl border border-line bg-white">{children}</View>
    </View>
  );
}

export function Row({
  label,
  value,
  onPress,
  labelClassName,
}: {
  label: string;
  value: string;
  onPress?: () => void;
  labelClassName?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className="flex-row items-center justify-between gap-3 border-b border-line px-4 py-3">
      <Text className={`text-sm font-medium ${labelClassName ?? 'text-ink'}`}>{label}</Text>
      <View className="min-w-0 flex-row items-center gap-1">
        <Text numberOfLines={1} className="text-sm text-ink-soft">
          {value}
        </Text>
        {onPress ? <Text className="text-sm text-ink-faint">›</Text> : null}
      </View>
    </Pressable>
  );
}
