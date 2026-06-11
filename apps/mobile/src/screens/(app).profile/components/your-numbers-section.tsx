import { Text, View } from 'react-native';

import { DisplayText } from '@/components/display-text';
import { SectionCard } from './section-card';

export function YourNumbersSection({
  targetKcal,
  macros,
  hasPending,
}: {
  targetKcal: number;
  macros: { proteinG: number; carbsG: number; fatG: number };
  hasPending: boolean;
}) {
  return (
    <SectionCard label="Your numbers">
      <View className="gap-3 px-4 py-3">
        {hasPending ? (
          <View className="rounded-xl bg-surface px-2 py-1">
            <Text className="text-[10px] uppercase text-ink-soft">
              Pending changes — starts tomorrow
            </Text>
          </View>
        ) : null}
        <View className="flex-row items-baseline justify-between">
          <Text className="text-sm text-ink-soft">Daily target</Text>
          <View className="flex-row items-baseline gap-1">
            <DisplayText className="text-2xl text-ink">{targetKcal}</DisplayText>
            <Text className="text-xs text-ink-soft">kcal</Text>
          </View>
        </View>
        <View className="flex-row gap-2">
          <MacroCell label="Protein" g={macros.proteinG} />
          <MacroCell label="Carbs" g={macros.carbsG} />
          <MacroCell label="Fat" g={macros.fatG} />
        </View>
      </View>
    </SectionCard>
  );
}

function MacroCell({ label, g }: { label: string; g: number }) {
  return (
    <View className="flex-1 items-center rounded-xl bg-surface px-2 py-2">
      <Text className="text-xs text-ink-soft">{label}</Text>
      <Text className="text-base font-medium text-ink">{g}g</Text>
    </View>
  );
}
