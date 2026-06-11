import { Pressable, View } from 'react-native';

import { DisplayText } from '@/components/display-text';

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
        <DisplayText className="text-2xl text-ink-soft">‹</DisplayText>
      </Pressable>
      <DisplayText className="text-lg text-ink">{label}</DisplayText>
      <Pressable
        onPress={onNext}
        disabled={!canGoNext}
        accessibilityRole="button"
        accessibilityLabel="Next week"
        className="h-10 w-10 items-center justify-center">
        <DisplayText className={`text-2xl ${canGoNext ? 'text-ink-soft' : 'text-ink-faint'}`}>›</DisplayText>
      </Pressable>
    </View>
  );
}
