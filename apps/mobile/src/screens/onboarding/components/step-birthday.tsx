import { View } from 'react-native';

import { BirthdayFields } from '@/components/birthday-fields';
import { StepHeading } from './step-heading';

export function StepBirthday({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View className="gap-6">
      <StepHeading
        title="When were you born?"
        subtitle="We use this to compute your age each time we run the formula."
      />
      <BirthdayFields value={value} onChange={onChange} />
    </View>
  );
}
