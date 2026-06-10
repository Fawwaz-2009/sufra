import { useState } from 'react';
import { Alert } from 'react-native';

import { formatHeight, formatWeight } from '@/lib/units';
import { ageFromBirthday } from '@sufra-web/worker/views/derive.ts';
import type { ProfileSnapshotView as ProfileSnapshot } from '@sufra-web/worker/views/profile-snapshot.ts';
import { ACTIVITY_DESCRIPTIONS, ACTIVITY_LABELS, useProfilePatch, type ProfileEdit } from '../helpers';
import { BirthdaySheet } from './birthday-sheet';
import { HeightSheet } from './height-sheet';
import { OptionSheet } from './option-sheet';
import { Row, SectionCard } from './section-card';

type OpenSheet = 'sex' | 'birthday' | 'height' | 'activity';

const SEX_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
] as const;

const ACTIVITY_OPTIONS = (Object.keys(ACTIVITY_LABELS) as (keyof typeof ACTIVITY_LABELS)[]).map(
  (level) => ({
    value: level,
    label: ACTIVITY_LABELS[level],
    description: ACTIVITY_DESCRIPTIONS[level],
  })
);

// The Weight row is read-only here: weight never flows through a Profile edit (ADR 0007) — logging a
// Weight is its own atomic dual-append flow, deferred on native until the Progress vertical.
// Sex/Activity are single-tap fields → the inline-commit OptionSheet; Birthday/Height are multi-input
// → the batched-Save sheets.
export function AboutYouSection({ profile }: { profile: ProfileSnapshot }) {
  const [open, setOpen] = useState<OpenSheet | null>(null);
  const patch = useProfilePatch();
  const ageYears = ageFromBirthday(profile.birthday);
  const close = () => setOpen(null);

  // Inline commit for single-tap fields — errors surface as a native alert (the sheet is already
  // closed by the time the request settles).
  const commit = (edit: ProfileEdit) =>
    patch.mutate(edit, {
      onError: () => Alert.alert("Couldn't save", 'Try again in a moment.'),
    });

  return (
    <SectionCard label="About you">
      <Row
        label="Sex"
        value={profile.sex === 'male' ? 'Male' : 'Female'}
        onPress={() => setOpen('sex')}
      />
      <Row
        label="Birthday"
        value={`${profile.birthday} · ${ageYears} yr`}
        onPress={() => setOpen('birthday')}
      />
      <Row
        label="Height"
        value={formatHeight(profile.heightCm, profile.displayHeightUnit)}
        onPress={() => setOpen('height')}
      />
      <Row label="Weight" value={formatWeight(profile.weightKg, profile.displayWeightUnit)} />
      <Row
        label="Activity"
        value={ACTIVITY_LABELS[profile.activityLevel]}
        onPress={() => setOpen('activity')}
      />

      <OptionSheet
        visible={open === 'sex'}
        title="Which formula should we use?"
        options={SEX_OPTIONS}
        selected={profile.sex}
        onSelect={(v) => {
          close();
          if (v !== profile.sex) commit({ sex: v });
        }}
        onClose={close}
      />
      <OptionSheet
        visible={open === 'activity'}
        title="Activity level"
        options={ACTIVITY_OPTIONS}
        selected={profile.activityLevel}
        onSelect={(v) => {
          close();
          if (v !== profile.activityLevel) commit({ activityLevel: v });
        }}
        onClose={close}
      />
      <BirthdaySheet visible={open === 'birthday'} onClose={close} profile={profile} />
      <HeightSheet visible={open === 'height'} onClose={close} profile={profile} />
    </SectionCard>
  );
}
