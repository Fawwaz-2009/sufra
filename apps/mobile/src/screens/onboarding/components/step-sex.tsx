import { Pressable, Text, View } from 'react-native';

import type { Sex } from '@sufra-web/worker/models/profile-snapshot.ts';
import { DisplayText } from '@/components/display-text';

export function StepSex({ value, onChange }: { value: Sex | null; onChange: (v: Sex) => void }) {
  return (
    <View className="gap-6">
      <View className="mb-6 gap-1">
        <DisplayText className="text-2xl text-ink">Which formula should we use?</DisplayText>
      </View>
      <View className="gap-3">
        <Pressable
          onPress={() => onChange('male')}
          accessibilityState={{ selected: value === 'male' }}
          className={`rounded-xl border px-4 py-3 ${value === 'male' ? 'border-flame bg-sand' : 'border-line'}`}>
          <Text className="font-medium text-ink">Male</Text>
        </Pressable>
        <Pressable
          onPress={() => onChange('female')}
          accessibilityState={{ selected: value === 'female' }}
          className={`rounded-xl border px-4 py-3 ${value === 'female' ? 'border-flame bg-sand' : 'border-line'}`}>
          <Text className="font-medium text-ink">Female</Text>
        </Pressable>
      </View>
    </View>
  );
}
