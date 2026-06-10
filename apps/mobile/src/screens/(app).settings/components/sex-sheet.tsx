import { useMemo, useState } from 'react';
import { View } from 'react-native';

import type { Sex } from '@sufra-web/worker/models/profile-snapshot.ts';
import { deriveProfile } from '@sufra-web/worker/views/derive.ts';
import type { ProfileSnapshotView as ProfileSnapshot } from '@sufra-web/worker/views/profile-snapshot.ts';
import { useProfilePatch } from '../helpers';
import { ChipButton } from './chip-button';
import { PreviewBox, SheetShell } from './sheet-shell';

export function SexSheet({
  visible,
  onClose,
  profile,
}: {
  visible: boolean;
  onClose: () => void;
  profile: ProfileSnapshot;
}) {
  const [value, setValue] = useState<Sex>(profile.sex);
  const patch = useProfilePatch();
  const previous = useMemo(() => deriveProfile(profile).targetKcal, [profile]);
  return (
    <SheetShell
      visible={visible}
      title="Which formula should we use?"
      onClose={onClose}
      onSave={() => patch.mutate({ sex: value }, { onSuccess: onClose })}
      saving={patch.isPending}
      disabled={value === profile.sex}
      error={patch.isError ? "Couldn't save. Try again." : null}>
      <View className="flex-row gap-2">
        <View className="flex-1">
          <ChipButton label="Male" selected={value === 'male'} onPress={() => setValue('male')} />
        </View>
        <View className="flex-1">
          <ChipButton
            label="Female"
            selected={value === 'female'}
            onPress={() => setValue('female')}
          />
        </View>
      </View>
      <PreviewBox inputs={{ ...profile, sex: value }} previousTarget={previous} />
    </SheetShell>
  );
}
