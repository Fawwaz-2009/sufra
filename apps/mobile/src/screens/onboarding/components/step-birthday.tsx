import { Text, View } from 'react-native';

import { BirthdayFields } from '@/components/birthday-fields';
import { DisplayText } from '@/components/display-text';

export function StepBirthday({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View className="gap-6">
      <View className="mb-6 gap-1">
        <DisplayText className="text-2xl text-ink">When were you born?</DisplayText>
        <Text className="text-sm text-ink-soft">
          We use this to compute your age each time we run the formula.
        </Text>
      </View>
      <BirthdayFields value={value} onChange={onChange} />
    </View>
  );
}
