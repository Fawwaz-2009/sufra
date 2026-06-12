import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { t } from '@lingui/core/macro';

import { LabeledInput } from '@/components/labeled-input';
import { UnitToggle } from '@/components/unit-toggle';
import { getClient, run } from '@/client/api-client';
import { meKey } from '@/client/me';
import { tomorrowLocalDate } from '@/lib/date';
import { kgToLb, lbToKg } from '@/lib/units';
import { deriveProfile } from '@sufra-web/worker/views/derive.ts';
import type { ProfileSnapshotView as ProfileSnapshot } from '@sufra-web/worker/views/profile-snapshot.ts';
import { PreviewBox, SheetShell } from './sheet-shell';

/**
 * Log Weight sheet — the native counterpart of the web's LogWeightSheet in `components/log-weight-sheet.tsx`.
 * POSTs to `/api/weights`, which atomically writes a `weights` row (the measurement) and a tomorrow
 * `profile_snapshots` row (effectiveFrom = tomorrow, per ADR 0002/0007). The current Target does NOT
 * change — that updates at tomorrow's midnight. PreviewBox shows tomorrow's Target so the Member can
 * see the effect before saving.
 */
export function LogWeightSheet({
  visible,
  onClose,
  profile,
}: {
  visible: boolean;
  onClose: () => void;
  profile: ProfileSnapshot;
}) {
  const [unit, setUnit] = useState<'kg' | 'lb'>(profile.displayWeightUnit);
  const [kg, setKg] = useState(profile.weightKg);
  // Local text state: prevents the trailing dot from being eaten when the parent coerces to number
  // mid-keystroke (same pattern as the web's StepWeight and the Height sheet's `defaultValue` approach).
  const [text, setText] = useState<string>(() =>
    profile.displayWeightUnit === 'kg'
      ? String(Math.round(profile.weightKg * 10) / 10)
      : String(Math.round(kgToLb(profile.weightKg)))
  );
  const queryClient = useQueryClient();
  const previousTarget = useMemo(() => deriveProfile(profile).targetKcal, [profile]);

  const mutation = useMutation({
    mutationFn: async (vars: { weightKg: number; unit: 'kg' | 'lb' }) =>
      run(
        (await getClient()).weights.create({
          payload: {
            weightKg: vars.weightKg,
            displayWeightUnit: vars.unit,
            effectiveFrom: tomorrowLocalDate(),
          },
        })
      ),
    onSuccess: async () => {
      // The dual-append also wrote a tomorrow Profile snapshot → invalidate /me (the profile + Day
      // summary). Invalidate the weight series + calorie-history too (Progress chart, calorie bars).
      await queryClient.invalidateQueries({ queryKey: meKey });
      await queryClient.invalidateQueries({ queryKey: ['weights'] });
      await queryClient.invalidateQueries({ queryKey: ['calorie-history'] });
      onClose();
    },
  });

  const valid = kg >= 30 && kg <= 300;

  const handleUnitChange = (u: 'kg' | 'lb') => {
    setUnit(u);
    setText(
      u === 'kg'
        ? String(Math.round(kg * 10) / 10)
        : String(Math.round(kgToLb(kg)))
    );
  };

  const handleTextChange = (v: string) => {
    setText(v);
    if (v === '' || v === '.' || v === '-') return;
    const n = Number(v);
    if (!Number.isFinite(n)) return;
    setKg(unit === 'kg' ? n : lbToKg(n));
  };

  return (
    <SheetShell
      visible={visible}
      title={t`Log weight`}
      onClose={onClose}
      onSave={() => mutation.mutate({ weightKg: kg, unit })}
      saving={mutation.isPending}
      disabled={!valid}
      error={mutation.isError ? t`Couldn't log that. Try again.` : null}>
      <UnitToggle
        value={unit}
        options={[
          { value: 'kg', label: 'kg' },
          { value: 'lb', label: 'lb' },
        ]}
        onChange={handleUnitChange}
      />
      <LabeledInput
        label={t`Weight (${unit})`}
        value={text}
        onChangeText={handleTextChange}
        keyboardType="decimal-pad"
        maxLength={6}
      />
      <PreviewBox inputs={{ ...profile, weightKg: kg }} previousTarget={previousTarget} />
    </SheetShell>
  );
}
