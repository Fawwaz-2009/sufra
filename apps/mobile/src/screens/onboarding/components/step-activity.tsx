import { Text, View } from 'react-native';

import type { ActivityLevel } from '@sufra-web/worker/models/profile-snapshot.ts';
import { ACTIVITY_MULTIPLIERS } from '@sufra-web/worker/views/derive.ts';
import { ChoiceChip } from './choice-chip';
import { StepHeading } from './step-heading';

const ACTIVITY_OPTIONS: readonly {
  value: ActivityLevel;
  label: string;
  description: string;
}[] = [
  { value: 'sedentary', label: 'Sedentary', description: 'Little or no exercise' },
  { value: 'light', label: 'Light', description: 'Exercise 1–3 days/week' },
  { value: 'moderate', label: 'Moderate', description: 'Exercise 3–5 days/week' },
  { value: 'active', label: 'Active', description: 'Exercise 6–7 days/week' },
];

export function StepActivity({
  value,
  onChange,
}: {
  value: ActivityLevel | null;
  onChange: (v: ActivityLevel) => void;
}) {
  return (
    <View className="gap-6">
      <StepHeading title="How active are you?" />
      <View className="gap-2">
        {ACTIVITY_OPTIONS.map((opt) => (
          <ChoiceChip
            key={opt.value}
            label={opt.label}
            description={opt.description}
            selected={value === opt.value}
            onPress={() => onChange(opt.value)}
          />
        ))}
      </View>
      <Text className="text-xs text-zinc-500">
        Multiplier applied to your BMR: {ACTIVITY_MULTIPLIERS.sedentary}× →{' '}
        {ACTIVITY_MULTIPLIERS.active}×.
      </Text>
    </View>
  );
}
