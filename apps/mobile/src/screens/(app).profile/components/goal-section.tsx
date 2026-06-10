import { useState } from 'react';

import type { ProfileSnapshotView as ProfileSnapshot } from '@sufra-web/worker/views/profile-snapshot.ts';
import { GoalSheet } from './goal-sheet';
import { Row, SectionCard } from './section-card';

export function GoalSection({ profile }: { profile: ProfileSnapshot }) {
  const [open, setOpen] = useState(false);
  const direction =
    profile.goalWeightKg < profile.weightKg
      ? 'Lose'
      : profile.goalWeightKg > profile.weightKg
        ? 'Gain'
        : 'Maintain';
  const sub =
    direction === 'Maintain'
      ? 'Holding current weight'
      : `${direction} to ${profile.goalWeightKg} kg · ~${profile.weeklyRateKg} kg/wk`;
  return (
    <SectionCard label="Goal">
      <Row label={direction} value={sub} onPress={() => setOpen(true)} />
      <GoalSheet visible={open} onClose={() => setOpen(false)} profile={profile} />
    </SectionCard>
  );
}
