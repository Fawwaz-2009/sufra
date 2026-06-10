import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { LabeledInput } from '@/components/labeled-input';
import { UnitToggle } from '@/components/unit-toggle';
import { cmToImperial, imperialToCm } from '@/lib/units';
import { deriveProfile } from '@sufra-web/worker/views/derive.ts';
import type { ProfileSnapshotView as ProfileSnapshot } from '@sufra-web/worker/views/profile-snapshot.ts';
import { useProfilePatch } from '../helpers';
import { PreviewBox, SheetShell } from './sheet-shell';

export function HeightSheet({
  visible,
  onClose,
  profile,
}: {
  visible: boolean;
  onClose: () => void;
  profile: ProfileSnapshot;
}) {
  const [unit, setUnit] = useState<'cm' | 'imperial'>(profile.displayHeightUnit);
  const [cm, setCm] = useState(profile.heightCm);
  const patch = useProfilePatch();
  const previous = useMemo(() => deriveProfile(profile).targetKcal, [profile]);
  const valid = cm >= 100 && cm <= 250;
  const changed = cm !== profile.heightCm || unit !== profile.displayHeightUnit;
  const imperial = cmToImperial(cm);
  return (
    <SheetShell
      visible={visible}
      title="Height"
      onClose={onClose}
      onSave={() =>
        patch.mutate({ heightCm: cm, displayHeightUnit: unit }, { onSuccess: onClose })
      }
      saving={patch.isPending}
      disabled={!valid || !changed}
      error={patch.isError ? "Couldn't save. Try again." : null}>
      <UnitToggle
        value={unit}
        options={[
          { value: 'cm', label: 'cm' },
          { value: 'imperial', label: 'ft + in' },
        ]}
        onChange={setUnit}
      />
      {unit === 'cm' ? (
        <LabeledInput
          label="Height (cm)"
          defaultValue={String(profile.heightCm)}
          onChangeText={(v) => {
            const n = Number(v);
            if (v !== '' && Number.isFinite(n)) setCm(Math.round(n));
          }}
          keyboardType="number-pad"
          maxLength={3}
        />
      ) : (
        <View className="flex-row gap-3">
          <View className="flex-1">
            <LabeledInput
              label="Feet"
              value={String(imperial.feet)}
              onChangeText={(v) => {
                const n = Number(v);
                if (Number.isFinite(n)) setCm(imperialToCm(n, imperial.inches));
              }}
              keyboardType="number-pad"
              maxLength={1}
            />
          </View>
          <View className="flex-1">
            <LabeledInput
              label="Inches"
              value={String(imperial.inches)}
              onChangeText={(v) => {
                const n = Number(v);
                if (Number.isFinite(n)) setCm(imperialToCm(imperial.feet, n));
              }}
              keyboardType="number-pad"
              maxLength={2}
            />
          </View>
        </View>
      )}
      <PreviewBox inputs={{ ...profile, heightCm: cm }} previousTarget={previous} />
    </SheetShell>
  );
}
