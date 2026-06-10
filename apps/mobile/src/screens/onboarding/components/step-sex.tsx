import { View } from 'react-native';

import type { Sex } from '@sufra-web/worker/models/profile-snapshot.ts';
import { ChoiceChip } from './choice-chip';
import { StepHeading } from './step-heading';

export function StepSex({ value, onChange }: { value: Sex | null; onChange: (v: Sex) => void }) {
  return (
    <View className="gap-6">
      <StepHeading title="Which formula should we use?" />
      <View className="gap-3">
        <ChoiceChip label="Male" selected={value === 'male'} onPress={() => onChange('male')} />
        <ChoiceChip
          label="Female"
          selected={value === 'female'}
          onPress={() => onChange('female')}
        />
      </View>
    </View>
  );
}
