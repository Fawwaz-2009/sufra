import { Trans } from '@lingui/react/macro';
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
        <DisplayText className="text-2xl text-ink"><Trans>When were you born?</Trans></DisplayText>
        <Text className="text-sm text-ink-soft">
          <Trans>We use this to compute your age each time we run the formula.</Trans>
        </Text>
      </View>
      <BirthdayFields value={value} onChange={onChange} />
    </View>
  );
}
