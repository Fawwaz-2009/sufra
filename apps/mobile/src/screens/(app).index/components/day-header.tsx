import { I18nManager, Pressable, Text, View } from 'react-native';
import { t } from '@lingui/core/macro';

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
    <View className="flex-row items-center">
      <DisplayText className="flex-1 text-2xl text-ink">{label}</DisplayText>
      <Pressable
        onPress={onPrev}
        accessibilityRole="button"
        accessibilityLabel={t`Previous week`}
        className="h-10 w-10 items-center justify-center">
        <Text className="text-2xl text-ink-soft">{I18nManager.isRTL ? '›' : '‹'}</Text>
      </Pressable>
      <Pressable
        onPress={onNext}
        disabled={!canGoNext}
        accessibilityRole="button"
        accessibilityLabel={t`Next week`}
        className="h-10 w-10 items-center justify-center">
        <Text className={`text-2xl ${canGoNext ? 'text-ink-soft' : 'text-ink-faint'}`}>
          {I18nManager.isRTL ? '‹' : '›'}
        </Text>
      </Pressable>
    </View>
  );
}
