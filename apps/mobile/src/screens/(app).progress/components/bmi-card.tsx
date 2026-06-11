/**
 * BmiCard — the BMI strip: current BMI against the universal WHO bands, with the Member's
 * Normal-range weight for their height. Ports apps/web/src/routes/progress/-components/bmi-card.tsx.
 * Bands are NOT sex-specific; height shifts only the kg labels, not the band breakpoints.
 */

import { Text, View } from 'react-native';

import { DisplayText } from '@/components/display-text';
import { Palette } from '@/constants/theme';
import { formatHeight, formatWeight } from '@/lib/units';
import type { ProfileSnapshotView as ProfileSnapshot } from '@sufra-web/worker/views/profile-snapshot.ts';

const BANDS = [
  { key: 'Under', lo: 0, hi: 18.5, label: 'Underweight' },
  { key: 'Normal', lo: 18.5, hi: 25, label: 'Normal weight' },
  { key: 'Over', lo: 25, hi: 30, label: 'Overweight' },
  { key: 'Obese', lo: 30, hi: 60, label: 'Obesity' },
] as const;

// The visual scale runs from "Underweight upper end - 5kg" to "Obesity start + 10kg"
// so the bar always has some context on either side of the Normal band.
const DISPLAY_BMI_MIN = 15;
const DISPLAY_BMI_MAX = 35;

export function BmiCard({ profile }: { profile: ProfileSnapshot }) {
  const { heightCm, weightKg } = profile;
  const m = heightCm / 100;
  const bmi = weightKg / (m * m);
  const band = BANDS.find((b) => bmi >= b.lo && bmi < b.hi) ?? BANDS[BANDS.length - 1]!;

  const kgForBmi = (b: number) => b * m * m;
  const pctForBmi = (b: number) =>
    Math.min(100, Math.max(0, ((b - DISPLAY_BMI_MIN) / (DISPLAY_BMI_MAX - DISPLAY_BMI_MIN)) * 100));

  return (
    <View className="rounded-2xl border border-line bg-white p-4">
      <View className="mb-2 flex-row items-start justify-between">
        <Text className="text-base font-semibold text-ink">BMI</Text>
        <Text className="text-xs text-ink-soft">
          {formatHeight(heightCm, profile.displayHeightUnit)} ·{' '}
          {formatWeight(weightKg, profile.displayWeightUnit)}
        </Text>
      </View>

      <View className="mb-2 flex-row items-baseline gap-3">
        <DisplayText className="text-3xl text-ink">{bmi.toFixed(1)}</DisplayText>
        <Text className="text-sm text-ink-soft">{band.label}</Text>
      </View>

      {/* The band strip + the Member's marker, positioned by percent of the display scale. */}
      <View style={{ height: 24 }}>
        {BANDS.map((b, i) => {
          const left = pctForBmi(b.lo);
          const right = pctForBmi(b.hi);
          const isFirst = i === 0;
          const isLast = i === BANDS.length - 1;
          return (
            <View
              key={b.key}
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: `${left}%`,
                width: `${right - left}%`,
                backgroundColor: bandColor(b.key, b.key === band.key),
                borderTopLeftRadius: isFirst ? 6 : 0,
                borderBottomLeftRadius: isFirst ? 6 : 0,
                borderTopRightRadius: isLast ? 6 : 0,
                borderBottomRightRadius: isLast ? 6 : 0,
              }}
            />
          );
        })}
        <View
          accessibilityLabel={`BMI ${bmi.toFixed(1)}`}
          style={{
            position: 'absolute',
            top: -4,
            height: 32,
            width: 2,
            backgroundColor: Palette.ink,
            left: `${pctForBmi(bmi)}%`,
            marginLeft: -1,
          }}
        />
      </View>

      <View className="mt-1 flex-row">
        {BANDS.map((b) => (
          <Text key={b.key} className="flex-1 text-center text-[10px] uppercase text-ink-soft">
            {b.key}
          </Text>
        ))}
      </View>

      <Text className="mt-2 text-xs text-ink-soft">
        Normal range for your height: ~{kgForBmi(18.5).toFixed(0)}–{kgForBmi(25).toFixed(0)} kg
      </Text>
    </View>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function bandColor(key: (typeof BANDS)[number]['key'], isCurrent: boolean): string {
  const alpha = isCurrent ? 0.7 : 0.3;
  if (key === 'Normal') return `rgba(83, 158, 166, ${alpha})`;
  if (key === 'Under' || key === 'Over') return `rgba(236, 143, 58, ${alpha})`;
  return `rgba(190, 59, 43, ${alpha})`;
}
