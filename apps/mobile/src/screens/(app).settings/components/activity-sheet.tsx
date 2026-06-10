import { useMemo, useState } from 'react';
import { View } from 'react-native';

import type { ActivityLevel } from '@sufra-web/worker/models/profile-snapshot.ts';
import { deriveProfile } from '@sufra-web/worker/views/derive.ts';
import type { ProfileSnapshotView as ProfileSnapshot } from '@sufra-web/worker/views/profile-snapshot.ts';
import { ACTIVITY_DESCRIPTIONS, ACTIVITY_LABELS, useProfilePatch } from '../helpers';
import { ChipButton } from './chip-button';
import { PreviewBox, SheetShell } from './sheet-shell';

export function ActivitySheet({
  visible,
  onClose,
  profile,
}: {
  visible: boolean;
  onClose: () => void;
  profile: ProfileSnapshot;
}) {
  const [value, setValue] = useState<ActivityLevel>(profile.activityLevel);
  const patch = useProfilePatch();
  const previous = useMemo(() => deriveProfile(profile).targetKcal, [profile]);
  return (
    <SheetShell
      visible={visible}
      title="Activity level"
      onClose={onClose}
      onSave={() => patch.mutate({ activityLevel: value }, { onSuccess: onClose })}
      saving={patch.isPending}
      disabled={value === profile.activityLevel}
      error={patch.isError ? "Couldn't save. Try again." : null}>
      <View className="gap-2">
        {(['sedentary', 'light', 'moderate', 'active'] as const).map((v) => (
          <ChipButton
            key={v}
            label={ACTIVITY_LABELS[v]}
            description={ACTIVITY_DESCRIPTIONS[v]}
            selected={value === v}
            onPress={() => setValue(v)}
          />
        ))}
      </View>
      <PreviewBox inputs={{ ...profile, activityLevel: value }} previousTarget={previous} />
    </SheetShell>
  );
}
