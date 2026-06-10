import { useMemo, useState } from 'react';

import { BirthdayFields } from '@/components/birthday-fields';
import { isValidBirthday } from '@/lib/date';
import { deriveProfile } from '@sufra-web/worker/views/derive.ts';
import type { ProfileSnapshotView as ProfileSnapshot } from '@sufra-web/worker/views/profile-snapshot.ts';
import { useProfilePatch } from '../helpers';
import { PreviewBox, SheetShell } from '@/components/sheet-shell';

export function BirthdaySheet({
  visible,
  onClose,
  profile,
}: {
  visible: boolean;
  onClose: () => void;
  profile: ProfileSnapshot;
}) {
  const [value, setValue] = useState(profile.birthday);
  const patch = useProfilePatch();
  const previous = useMemo(() => deriveProfile(profile).targetKcal, [profile]);
  const valid = isValidBirthday(value);
  return (
    <SheetShell
      visible={visible}
      title="Your birthday"
      onClose={onClose}
      onSave={() => patch.mutate({ birthday: value }, { onSuccess: onClose })}
      saving={patch.isPending}
      disabled={!valid || value === profile.birthday}
      error={patch.isError ? "Couldn't save. Try again." : null}>
      <BirthdayFields value={value} onChange={setValue} />
      {valid ? (
        <PreviewBox inputs={{ ...profile, birthday: value }} previousTarget={previous} />
      ) : null}
    </SheetShell>
  );
}
