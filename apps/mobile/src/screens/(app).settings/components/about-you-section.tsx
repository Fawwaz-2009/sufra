import { useState } from 'react';

import { formatHeight, formatWeight } from '@/lib/units';
import { ageFromBirthday } from '@sufra-web/worker/views/derive.ts';
import type { ProfileSnapshotView as ProfileSnapshot } from '@sufra-web/worker/views/profile-snapshot.ts';
import { ACTIVITY_LABELS } from '../helpers';
import { ActivitySheet } from './activity-sheet';
import { BirthdaySheet } from './birthday-sheet';
import { HeightSheet } from './height-sheet';
import { Row, SectionCard } from './section-card';
import { SexSheet } from './sex-sheet';

type OpenSheet = 'sex' | 'birthday' | 'height' | 'activity';

// The Weight row is read-only here: weight never flows through a Profile edit (ADR 0007) — logging a
// Weight is its own atomic dual-append flow, deferred on native until the Progress vertical.
export function AboutYouSection({ profile }: { profile: ProfileSnapshot }) {
  const [open, setOpen] = useState<OpenSheet | null>(null);
  const ageYears = ageFromBirthday(profile.birthday);
  const close = () => setOpen(null);
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

      <SexSheet visible={open === 'sex'} onClose={close} profile={profile} />
      <BirthdaySheet visible={open === 'birthday'} onClose={close} profile={profile} />
      <HeightSheet visible={open === 'height'} onClose={close} profile={profile} />
      <ActivitySheet visible={open === 'activity'} onClose={close} profile={profile} />
    </SectionCard>
  );
}
