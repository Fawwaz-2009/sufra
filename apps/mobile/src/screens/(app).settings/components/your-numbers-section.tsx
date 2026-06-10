import { Text, View } from 'react-native';

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
          <View className="rounded-xl bg-zinc-100 px-2 py-1">
            <Text className="text-[10px] uppercase text-zinc-500">
              Pending changes — starts tomorrow
            </Text>
          </View>
        ) : null}
        <View className="flex-row items-baseline justify-between">
          <Text className="text-sm text-zinc-500">Daily target</Text>
          <View className="flex-row items-baseline gap-1">
            <Text className="text-2xl font-semibold text-black">{targetKcal}</Text>
            <Text className="text-xs text-zinc-500">kcal</Text>
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
    <View className="flex-1 items-center rounded-xl bg-zinc-100 px-2 py-2">
      <Text className="text-xs text-zinc-500">{label}</Text>
      <Text className="text-base font-medium text-black">{g}g</Text>
    </View>
  );
}
