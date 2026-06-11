import { Pressable, Text, View } from 'react-native';

export function BackButton({ onPress, disabled }: { onPress: () => void; disabled: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel="Back"
      className="h-10 w-10 items-center justify-center rounded-[9999px]"
      style={disabled ? { opacity: 0 } : undefined}>
      <Text className="text-2xl font-semibold text-ink">‹</Text>
    </Pressable>
  );
}

export function Dots({ count, current }: { count: number; current: number }) {
  return (
    <View className="flex-1 flex-row items-center justify-center gap-2">
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          className={`h-2 w-2 rounded-[9999px] ${i + 1 <= current ? 'bg-flame' : 'bg-sand-2'}`}
        />
      ))}
    </View>
  );
}
