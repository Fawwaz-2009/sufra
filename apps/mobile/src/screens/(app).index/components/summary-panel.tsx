import { type Dispatch, type SetStateAction } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { DisplayText } from '@/components/display-text';
import { Palette } from '@/constants/theme';

import type { DaySummary } from '../helpers';

export type RingMode = 'remaining' | 'consumed';

const STROKE_WIDTH = 13;
const R = 93.5;
const CX = 100;
const CY = 100;
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
      <View className="gap-2 rounded-2xl bg-surface p-4">
        <Text className="font-semibold text-ink">Profile setup is next</Text>
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
    ringMode === 'remaining' ? (summary.remaining >= 0 ? 'left' : 'over') : 'eaten';

  let progressStroke: string;
  if (ratio <= 1) {
    progressStroke = 'url(#emberGrad)';
  } else if (ratio <= 1.15) {
    progressStroke = Palette.amber;
  } else {
    progressStroke = Palette.red;
  }

  return (
    <View className="items-center">
      {/* Ring */}
      <Pressable
        onPress={() => setRingMode((mode) => (mode === 'remaining' ? 'consumed' : 'remaining'))}
        accessibilityRole="button"
        accessibilityLabel="Toggle Day summary reading"
        accessibilityHint="Toggles between remaining and consumed"
        style={{ width: 200, height: 200 }}>
        <Svg width={200} height={200} viewBox="0 0 200 200">
          <Defs>
            <LinearGradient id="emberGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={Palette.gradientStart} />
              <Stop offset="1" stopColor={Palette.gradientEnd} />
            </LinearGradient>
          </Defs>
          {/* Track */}
          <Circle
            cx={CX}
            cy={CY}
            r={R}
            stroke={Palette.track}
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
              transform="rotate(-90 100 100)"
            />
          )}
        </Svg>
        <View style={StyleSheet.absoluteFill} className="items-center justify-center">
          <DisplayText
            style={{ fontSize: 42, lineHeight: 46, fontVariant: ['tabular-nums'] }}
            className="text-ink">
            {Math.abs(ringValue)}
          </DisplayText>
          <Text className="text-sm text-ink-soft">{ringLabel}</Text>
        </View>
      </Pressable>

      {/* Macro trio */}
      <View className="mt-6 w-full flex-row gap-4">
        <MacroColumn
          label="PROTEIN"
          eaten={summary.proteinG}
          goal={summary.macros.proteinG}
          color={Palette.teal}
        />
        <MacroColumn
          label="CARBS"
          eaten={summary.carbsG}
          goal={summary.macros.carbsG}
          color={Palette.amber}
        />
        <MacroColumn
          label="FAT"
          eaten={summary.fatG}
          goal={summary.macros.fatG}
          color={Palette.flame}
        />
      </View>
    </View>
  );
}

function MacroColumn({
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
    <View className="flex-1 gap-1">
      <Text className="text-[10px] font-bold uppercase text-ink-soft">{label}</Text>
      <Text className="text-sm text-ink">{`${eaten} / ${goal}g`}</Text>
      <View className="h-1 w-full overflow-hidden rounded-[9999px] bg-track">
        <View
          className="h-1 rounded-[9999px]"
          style={{ backgroundColor: color, width: `${pct * 100}%` }}
        />
      </View>
    </View>
  );
}
