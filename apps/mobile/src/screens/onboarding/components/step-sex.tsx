import { Trans } from '@lingui/react/macro';
import { Pressable, Text, View } from 'react-native';

import type { Sex } from '@sufra-web/worker/models/profile-snapshot.ts';
import { DisplayText } from '@/components/display-text';

export function StepSex({ value, onChange }: { value: Sex | null; onChange: (v: Sex) => void }) {
  return (
    <View className="gap-6">
      <View className="mb-6 gap-1">
        <DisplayText className="text-2xl text-ink"><Trans>Which formula should we use?</Trans></DisplayText>
      </View>
      <View className="gap-3">
        <Pressable
          onPress={() => onChange('male')}
          accessibilityState={{ selected: value === 'male' }}
          className={`rounded-xl px-4 py-3 ${value === 'male' ? 'border border-flame bg-surface' : 'bg-surface'}`}>
          <Text className="font-medium text-ink"><Trans>Male</Trans></Text>
        </Pressable>
        <Pressable
          onPress={() => onChange('female')}
          accessibilityState={{ selected: value === 'female' }}
          className={`rounded-xl px-4 py-3 ${value === 'female' ? 'border border-flame bg-surface' : 'bg-surface'}`}>
          <Text className="font-medium text-ink"><Trans>Female</Trans></Text>
        </Pressable>
      </View>
    </View>
  );
}
