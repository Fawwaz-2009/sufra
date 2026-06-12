import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { Text, View } from 'react-native';

import type { ActivityLevel } from '@sufra-web/worker/models/profile-snapshot.ts';
import { ACTIVITY_MULTIPLIERS } from '@sufra-web/worker/views/derive.ts';
import { ChoiceChip } from './choice-chip';
import { StepHeading } from './step-heading';

export function StepActivity({
  value,
  onChange,
}: {
  value: ActivityLevel | null;
  onChange: (v: ActivityLevel) => void;
}) {
  const ACTIVITY_OPTIONS: readonly {
    value: ActivityLevel;
    label: string;
    description: string;
  }[] = [
    { value: 'sedentary', label: t`Sedentary`, description: t`Little or no exercise` },
    { value: 'light', label: t`Light`, description: t`Exercise 1–3 days/week` },
    { value: 'moderate', label: t`Moderate`, description: t`Exercise 3–5 days/week` },
    { value: 'active', label: t`Active`, description: t`Exercise 6–7 days/week` },
  ];

  return (
    <View className="gap-6">
      <StepHeading title={t`How active are you?`} />
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
      <Text className="text-xs text-ink-soft">
        <Trans>
          Multiplier applied to your BMR: {ACTIVITY_MULTIPLIERS.sedentary}× →{' '}
          {ACTIVITY_MULTIPLIERS.active}×.
        </Trans>
      </Text>
    </View>
  );
}
