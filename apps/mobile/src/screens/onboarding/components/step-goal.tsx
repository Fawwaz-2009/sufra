import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { Pressable } from '@/components/pressable';

import { DisplayText } from '@/components/display-text';
import { GoalSlider } from '@/components/goal-slider';
import { kgToLb } from '@/lib/units';
import { deriveProfile } from '@sufra-web/worker/views/derive.ts';
import type { Draft } from '../types';

export function StepGoal({
  draft,
  onGoalWeightChange,
  onRateChange,
}: {
  draft: Draft;
  onGoalWeightChange: (kg: number) => void;
  onRateChange: (r: number) => void;
}) {
  const current = draft.weightKg ?? 70;
  // Slider operates in integer kg; the Member's actual weight may be
  // fractional (e.g. 93.5). The thumb position uses the rounded value;
  // the "Current" label below shows the real fractional value.
  const currentRounded = Math.round(current);
  const goal = draft.goalWeightKg ?? current;
  // Asymmetric range: lose more than you gain, in realistic chunks.
  // Floored/capped at the schema's absolute bounds (30 / 300 kg).
  const min = Math.max(30, currentRounded - 60);
  const max = Math.min(300, currentRounded + 30);
  const isMaintain = Math.abs(goal - current) < 0.5;
  const direction =
    goal < current ? t`Lose` : goal > current ? t`Gain` : t`Maintain`;
  const diffKg = Math.abs(goal - current);
  const currentDisplay =
    draft.displayWeightUnit === 'kg'
      ? `${Math.round(current * 10) / 10} kg`
      : `${Math.round(kgToLb(current))} lb`;

  const preview = useMemo(() => {
    if (
      !draft.sex ||
      !draft.birthday ||
      draft.heightCm == null ||
      draft.weightKg == null ||
      !draft.activityLevel ||
      draft.goalWeightKg == null
    ) {
      return null;
    }
    return deriveProfile({
      sex: draft.sex,
      birthday: draft.birthday,
      heightCm: draft.heightCm,
      weightKg: draft.weightKg,
      activityLevel: draft.activityLevel,
      goalWeightKg: draft.goalWeightKg,
      weeklyRateKg: draft.weeklyRateKg,
    });
  }, [
    draft.sex,
    draft.birthday,
    draft.heightCm,
    draft.weightKg,
    draft.activityLevel,
    draft.goalWeightKg,
    draft.weeklyRateKg,
  ]);

  const etaWeeks = !isMaintain && draft.weeklyRateKg > 0 ? diffKg / draft.weeklyRateKg : null;

  return (
    <View className="gap-6">
      <View className="mb-6 gap-1">
        <DisplayText className="text-2xl text-ink"><Trans>Your goal</Trans></DisplayText>
        <Text className="text-sm text-ink-soft"><Trans>Pick a goal weight. Slide to current to maintain.</Trans></Text>
      </View>

      <View className="gap-3">
        <View className="flex-row items-baseline justify-between">
          <Text className="text-sm font-medium text-ink">{direction}</Text>
          <Text className="text-2xl font-semibold text-ink">{goal} kg</Text>
        </View>
        <GoalSlider min={min} max={max} value={Math.round(goal)} onChange={onGoalWeightChange} />
        <View className="flex-row justify-between">
          <Text className="text-[10px] text-ink-soft">{min} kg</Text>
          <Text className="text-[10px] text-ink-soft"><Trans>Current: {currentDisplay}</Trans></Text>
          <Text className="text-[10px] text-ink-soft">{max} kg</Text>
        </View>
      </View>

      {!isMaintain ? (
        <View className="gap-2">
          <Text className="text-sm font-medium text-ink"><Trans>How fast?</Trans></Text>
          <View className="flex-row gap-2">
            <RateChip
              label={t`Slowly`}
              sub="~0.25 kg/wk"
              selected={draft.weeklyRateKg === 0.25}
              onPress={() => onRateChange(0.25)}
            />
            <RateChip
              label={t`Moderately`}
              sub="~0.5 kg/wk"
              selected={draft.weeklyRateKg === 0.5}
              onPress={() => onRateChange(0.5)}
            />
          </View>
        </View>
      ) : null}

      {preview ? (
        <View className="rounded-xl bg-white p-4">
          <Text className="text-xs uppercase text-ink-soft"><Trans>Daily target</Trans></Text>
          <View className="mt-1 flex-row items-baseline gap-1">
            <Text className="text-3xl font-semibold text-ink">{preview.targetKcal}</Text>
            <Text className="text-sm text-ink-soft">kcal</Text>
          </View>
          {etaWeeks != null ? (
            <Text className="mt-2 text-xs text-ink-soft">
              <Trans>At this rate, ~{Math.round(etaWeeks)} weeks to reach your goal.</Trans>
            </Text>
          ) : null}
          <Text className="mt-3 text-xs text-ink-soft">
            <Trans>P {preview.macros.proteinG}g · C {preview.macros.carbsG}g · F {preview.macros.fatG}g</Trans>
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function RateChip({
  label,
  sub,
  selected,
  onPress,
}: {
  label: string;
  sub: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityState={{ selected }}
      className={`flex-1 gap-1 rounded-xl px-3 py-3 ${selected ? 'border border-flame bg-surface' : 'bg-surface'}`}>
      <Text className="text-sm font-medium text-ink">{label}</Text>
      <Text className="text-[10px] text-ink-soft">{sub}</Text>
    </Pressable>
  );
}
