import { Pressable, Text, View } from 'react-native';

export function DayHeader({
  label,
  onPrev,
  onNext,
  canGoNext,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  canGoNext: boolean;
}) {
  return (
    <View className="flex-row items-center justify-between">
      <Pressable
        onPress={onPrev}
        accessibilityRole="button"
        accessibilityLabel="Previous week"
        className="h-10 w-10 items-center justify-center">
        <Text className="text-2xl text-zinc-700">‹</Text>
      </Pressable>
      <Text className="text-base font-semibold text-black">{label}</Text>
      <Pressable
        onPress={onNext}
        disabled={!canGoNext}
        accessibilityRole="button"
        accessibilityLabel="Next week"
        className="h-10 w-10 items-center justify-center">
        <Text className={`text-2xl ${canGoNext ? 'text-zinc-700' : 'text-zinc-300'}`}>›</Text>
      </Pressable>
    </View>
  );
}
