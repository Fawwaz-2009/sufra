import { Text, View } from 'react-native';

import { DisplayText } from '@/components/display-text';

export function StepHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View className="mb-6 gap-1">
      <DisplayText className="text-2xl text-ink">{title}</DisplayText>
      {subtitle ? <Text className="text-sm text-ink-soft">{subtitle}</Text> : null}
    </View>
  );
}
