import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { DisplayText } from '@/components/display-text';
import { GoalSlider } from '@/components/goal-slider';
import { kgToLb } from '@/lib/units';
import { deriveProfile } from '@sufra-web/worker/views/derive.ts';
import type { ProfileSnapshotView as ProfileSnapshot } from '@sufra-web/worker/views/profile-snapshot.ts';
import { useProfilePatch } from '../helpers';
import { ChipButton } from './chip-button';
import { PreviewBox, SheetShell } from '@/components/sheet-shell';

export function GoalSheet({
  visible,
  onClose,
  profile,
}: {
  visible: boolean;
  onClose: () => void;
  profile: ProfileSnapshot;
}) {
  const [goalKg, setGoalKg] = useState(profile.goalWeightKg);
  const [rate, setRate] = useState(profile.weeklyRateKg);
  const patch = useProfilePatch();
  const previous = useMemo(() => deriveProfile(profile).targetKcal, [profile]);
  // Integer-kg slider; fractional weights round for thumb position. Range asymmetric: lose up to
  // 60 kg, gain up to 30 — wide enough for realistic goals, bounded by the schema's 30–300.
  const currentRounded = Math.round(profile.weightKg);
  const min = Math.max(30, currentRounded - 60);
  const max = Math.min(300, currentRounded + 30);
  const isMaintain = Math.abs(goalKg - profile.weightKg) < 0.5;
  const effectiveRate = isMaintain ? 0 : rate;
  const direction =
    goalKg < profile.weightKg ? t`Lose` : goalKg > profile.weightKg ? t`Gain` : t`Maintain`;
  const currentDisplay =
    profile.displayWeightUnit === 'kg'
      ? `${Math.round(profile.weightKg * 10) / 10} kg`
      : `${Math.round(kgToLb(profile.weightKg))} lb`;
  const valid = isMaintain || rate > 0;
  const changed = goalKg !== profile.goalWeightKg || effectiveRate !== profile.weeklyRateKg;
  return (
    <SheetShell
      visible={visible}
      title={t`Your goal`}
      onClose={onClose}
      onSave={() =>
        patch.mutate({ goalWeightKg: goalKg, weeklyRateKg: effectiveRate }, { onSuccess: onClose })
      }
      saving={patch.isPending}
      disabled={!valid || !changed}
      error={patch.isError ? t`Couldn't save. Try again.` : null}>
      <View className="gap-2">
        <View className="flex-row items-baseline justify-between">
          <Text className="text-sm font-medium text-ink">{direction}</Text>
          <DisplayText className="text-2xl text-ink">{goalKg} kg</DisplayText>
        </View>
        <GoalSlider min={min} max={max} value={Math.round(goalKg)} onChange={setGoalKg} />
        <View className="flex-row justify-between">
          <Text className="text-[10px] text-ink-soft">{min} kg</Text>
          <Text className="text-[10px] text-ink-soft">
            <Trans>Now: {currentDisplay}</Trans>
          </Text>
          <Text className="text-[10px] text-ink-soft">{max} kg</Text>
        </View>
      </View>

      {!isMaintain ? (
        <View className="gap-2">
          <Text className="text-sm font-medium text-ink">
            <Trans>How fast?</Trans>
          </Text>
          <View className="flex-row gap-2">
            <View className="flex-1">
              <ChipButton
                label={t`Slowly`}
                description="~0.25 kg/wk"
                selected={rate === 0.25}
                onPress={() => setRate(0.25)}
              />
            </View>
            <View className="flex-1">
              <ChipButton
                label={t`Moderately`}
                description="~0.5 kg/wk"
                selected={rate === 0.5}
                onPress={() => setRate(0.5)}
              />
            </View>
          </View>
        </View>
      ) : null}

      <PreviewBox
        inputs={{ ...profile, goalWeightKg: goalKg, weeklyRateKg: effectiveRate }}
        previousTarget={previous}
      />
    </SheetShell>
  );
}
