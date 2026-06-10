import { type Dispatch, type SetStateAction } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { DaySummary } from '../helpers';

export type RingMode = 'remaining' | 'consumed';

export function SummaryPanel({
  ringMode,
  setRingMode,
  summary,
}: {
  ringMode: RingMode;
  setRingMode: Dispatch<SetStateAction<RingMode>>;
  summary: DaySummary | null;
}) {
  if (!summary) {
    return (
      <View className="gap-2 rounded-2xl bg-zinc-100 p-4">
        <Text className="text-lg font-bold text-black">Profile setup is next</Text>
        <Text className="text-sm text-zinc-500">
          Meals can be logged now. The Day Target appears after onboarding lands on native.
        </Text>
      </View>
    );
  }

  const ringValue = ringMode === 'remaining' ? summary.remaining : summary.consumed;
  const ringLabel =
    ringMode === 'remaining' ? (summary.remaining >= 0 ? 'Remaining' : 'Over') : 'Consumed';

  return (
    <View className="flex-row items-center gap-4 rounded-2xl bg-zinc-100 p-4">
      <Pressable
        onPress={() => setRingMode((mode) => (mode === 'remaining' ? 'consumed' : 'remaining'))}
        accessibilityRole="button"
        accessibilityLabel="Toggle Day summary reading"
        className="h-[118px] w-[118px] shrink-0 items-center justify-center rounded-[9999px] border-[10px]"
        style={{ borderColor: colorForRatio(summary.ratio) }}>
        <Text className="text-3xl font-semibold text-black">{Math.abs(ringValue)}</Text>
        <Text className="text-[10px] font-bold uppercase text-zinc-500">
          {ringLabel}
        </Text>
        <Text className="text-[10px] text-zinc-500">tap to toggle</Text>
      </Pressable>

      <View className="min-w-0 flex-1 gap-2">
        <MacroRow
          label="Protein"
          eaten={summary.proteinG}
          goal={summary.macros.proteinG}
          color="#2F9E44"
        />
        <MacroRow
          label="Carbs"
          eaten={summary.carbsG}
          goal={summary.macros.carbsG}
          color="#208AEF"
        />
        <MacroRow label="Fat" eaten={summary.fatG} goal={summary.macros.fatG} color="#E67700" />
      </View>
    </View>
  );
}

function MacroRow({
  label,
  eaten,
  goal,
  color,
}: {
  label: string;
  eaten: number;
  goal: number;
  color: string;
}) {
  const pct = goal > 0 ? Math.min(1, eaten / goal) : 0;
  return (
    <View className="gap-1">
      <View className="flex-row items-baseline justify-between gap-2">
        <Text className="text-sm text-zinc-500">{label}</Text>
        <Text className="shrink-0 text-sm text-black">{`${eaten} / ${goal}g`}</Text>
      </View>
      <View className="h-2 overflow-hidden rounded-[9999px] bg-zinc-200">
        <View className="h-2 rounded-[9999px]" style={{ backgroundColor: color, width: `${pct * 100}%` }} />
      </View>
    </View>
  );
}

function colorForRatio(ratio: number): string {
  if (ratio <= 1) return '#2F9E44';
  if (ratio <= 1.15) return '#E67700';
  return '#E5484D';
}
