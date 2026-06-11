import { type Dispatch, type SetStateAction } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { DisplayText } from '@/components/display-text';
import { Palette } from '@/constants/theme';

import type { DaySummary } from '../helpers';

export type RingMode = 'remaining' | 'consumed';

const STROKE_WIDTH = 11;
const R = 56.5;
const CX = 62;
const CY = 62;
const C = 2 * Math.PI * R;

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
      <View className="gap-2 rounded-2xl bg-card p-4">
        <Text className="text-lg font-bold text-ink">Profile setup is next</Text>
        <Text className="text-sm text-ink-soft">
          Meals can be logged now. The Day Target appears after onboarding lands on native.
        </Text>
      </View>
    );
  }

  const consumed = summary.consumed;
  const target = summary.target;
  const ratio = summary.ratio;
  const p = target > 0 ? Math.min(consumed / target, 1) : 0;

  const ringValue = ringMode === 'remaining' ? summary.remaining : summary.consumed;
  const ringLabel =
    ringMode === 'remaining' ? (summary.remaining >= 0 ? 'Remaining' : 'Over') : 'Consumed';

  let progressStroke: string;
  if (ratio <= 1) {
    progressStroke = 'url(#flameGrad)';
  } else if (ratio <= 1.15) {
    progressStroke = Palette.amber;
  } else {
    progressStroke = Palette.red;
  }

  return (
    <View className="flex-row items-center gap-4 rounded-2xl bg-card p-4">
      <Pressable
        onPress={() => setRingMode((mode) => (mode === 'remaining' ? 'consumed' : 'remaining'))}
        accessibilityRole="button"
        accessibilityLabel="Toggle Day summary reading"
        accessibilityHint="Toggles between remaining and consumed"
        style={{ width: 124, height: 124, flexShrink: 0 }}>
        <Svg width={124} height={124} viewBox="0 0 124 124">
          <Defs>
            <LinearGradient id="flameGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={Palette.gradientStart} />
              <Stop offset="1" stopColor={Palette.gradientEnd} />
            </LinearGradient>
          </Defs>
          {/* Track */}
          <Circle
            cx={CX}
            cy={CY}
            r={R}
            stroke={Palette.sand2}
            strokeWidth={STROKE_WIDTH}
            fill="none"
          />
          {/* Progress */}
          {p > 0 && (
            <Circle
              cx={CX}
              cy={CY}
              r={R}
              stroke={progressStroke}
              strokeWidth={STROKE_WIDTH}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${C * p} ${C}`}
              transform="rotate(-90 62 62)"
            />
          )}
        </Svg>
        <View style={StyleSheet.absoluteFill} className="items-center justify-center">
          <DisplayText className="text-3xl text-ink">{Math.abs(ringValue)}</DisplayText>
          <Text className="text-[10px] font-bold uppercase text-ink-soft">{ringLabel}</Text>
        </View>
      </Pressable>

      <View className="min-w-0 flex-1 gap-2">
        <MacroRow
          label="Protein"
          eaten={summary.proteinG}
          goal={summary.macros.proteinG}
          color={Palette.teal}
        />
        <MacroRow
          label="Carbs"
          eaten={summary.carbsG}
          goal={summary.macros.carbsG}
          color={Palette.amber}
        />
        <MacroRow label="Fat" eaten={summary.fatG} goal={summary.macros.fatG} color={Palette.flame} />
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
        <Text className="text-sm text-ink-soft">{label}</Text>
        <Text className="shrink-0 text-sm text-ink">{`${eaten} / ${goal}g`}</Text>
      </View>
      <View className="h-2 overflow-hidden rounded-[9999px] bg-sand-2">
        <View className="h-2 rounded-[9999px]" style={{ backgroundColor: color, width: `${pct * 100}%` }} />
      </View>
    </View>
  );
}
