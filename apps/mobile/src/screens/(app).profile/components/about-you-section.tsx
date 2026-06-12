import { useState } from 'react';
import { Alert } from 'react-native';
import { t } from '@lingui/core/macro';

import { formatHeight, formatWeight } from '@/lib/units';
import { ageFromBirthday } from '@sufra-web/worker/views/derive.ts';
import type { ProfileSnapshotView as ProfileSnapshot } from '@sufra-web/worker/views/profile-snapshot.ts';
import { getActivityDescriptions, getActivityLabels, useProfilePatch, type ProfileEdit } from '../helpers';
import { BirthdaySheet } from './birthday-sheet';
import { HeightSheet } from './height-sheet';
import { LogWeightSheet } from '@/components/log-weight-sheet';
import { OptionSheet } from './option-sheet';
import { Row, SectionCard } from './section-card';

type OpenSheet = 'sex' | 'birthday' | 'height' | 'weight' | 'activity';

// The Weight row is read-only here: weight never flows through a Profile edit (ADR 0007) — logging a
// Weight is its own atomic dual-append flow, deferred on native until the Progress vertical.
// Sex/Activity are single-tap fields → the inline-commit OptionSheet; Birthday/Height are multi-input
// → the batched-Save sheets.
export function AboutYouSection({ profile }: { profile: ProfileSnapshot }) {
  const [open, setOpen] = useState<OpenSheet | null>(null);
  const patch = useProfilePatch();
  const ageYears = ageFromBirthday(profile.birthday);
  const close = () => setOpen(null);

  // Options defined inside the component so t`` runs inside a render/hook context.
  const sexOptions = [
    { value: 'male' as const, label: t`Male` },
    { value: 'female' as const, label: t`Female` },
  ] as const;

  const activityLabels = getActivityLabels();
  const activityDescriptions = getActivityDescriptions();
  const activityOptions = (Object.keys(activityLabels) as (keyof typeof activityLabels)[]).map(
    (level) => ({
      value: level,
      label: activityLabels[level],
      description: activityDescriptions[level],
    })
  ) as { value: keyof typeof activityLabels; label: string; description: string }[];

  // Inline commit for single-tap fields — errors surface as a native alert (the sheet is already
  // closed by the time the request settles).
  const commit = (edit: ProfileEdit) =>
    patch.mutate(edit, {
      onError: () => Alert.alert(t`Couldn't save`, t`Try again in a moment.`),
    });

  return (
    <SectionCard label={t`About you`}>
      <Row
        label={t`Sex`}
        value={profile.sex === 'male' ? t`Male` : t`Female`}
        onPress={() => setOpen('sex')}
      />
      <Row
        label={t`Birthday`}
        value={`${profile.birthday} · ${ageYears} yr`}
        onPress={() => setOpen('birthday')}
      />
      <Row
        label={t`Height`}
        value={formatHeight(profile.heightCm, profile.displayHeightUnit)}
        onPress={() => setOpen('height')}
      />
      <Row
        label={t`Weight`}
        value={formatWeight(profile.weightKg, profile.displayWeightUnit)}
        onPress={() => setOpen('weight')}
      />
      <Row
        label={t`Activity`}
        value={activityLabels[profile.activityLevel]}
        onPress={() => setOpen('activity')}
      />

      <OptionSheet
        visible={open === 'sex'}
        title={t`Which formula should we use?`}
        options={sexOptions}
        selected={profile.sex}
        onSelect={(v) => {
          close();
          if (v !== profile.sex) commit({ sex: v });
        }}
        onClose={close}
      />
      <OptionSheet
        visible={open === 'activity'}
        title={t`Activity level`}
        options={activityOptions}
        selected={profile.activityLevel}
        onSelect={(v) => {
          close();
          if (v !== profile.activityLevel) commit({ activityLevel: v });
        }}
        onClose={close}
      />
      <BirthdaySheet visible={open === 'birthday'} onClose={close} profile={profile} />
      <HeightSheet visible={open === 'height'} onClose={close} profile={profile} />
      <LogWeightSheet visible={open === 'weight'} onClose={close} profile={profile} />
    </SectionCard>
  );
}
