/**
 * WeightCard — card showing the Weight over time chart with a period picker and a Log Weight action.
 * Ports apps/web/src/routes/progress/-components/weight-card.tsx.
 * Weights are user-correctable via delete (ADR 0007); profile_snapshots are never touched here.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pressable, Text, View } from 'react-native';

import { LogWeightSheet } from '@/components/log-weight-sheet';
import { formatWeight } from '@/lib/units';
import type { ProfileSnapshotView as ProfileSnapshot } from '@sufra-web/worker/views/profile-snapshot.ts';

import { WEIGHT_PERIODS, type WeightPeriod, weightsQueryOptions } from '../helpers';
import { PeriodChips } from './period-chips';
import { WeightChart } from './weight-chart';

interface WeightCardProps {
  profile: ProfileSnapshot;
  period: WeightPeriod;
  onPeriodChange: (p: WeightPeriod) => void;
}

export function WeightCard({ profile, period, onPeriodChange }: WeightCardProps) {
  const [logOpen, setLogOpen] = useState(false);
  const { data } = useQuery(weightsQueryOptions(period));
  const weights = data ?? [];

  // noUncheckedIndexedAccess: weights[weights.length - 1] is WeightView | undefined
  const latest = weights.length > 0 ? weights[weights.length - 1] : undefined;

  return (
    <View className="rounded-2xl border border-line bg-card p-4">
      {/* Header row */}
      <View className="mb-2 flex-row items-start justify-between">
        <Text className="text-base font-semibold text-ink">Weight over time</Text>
        <Pressable
          onPress={() => setLogOpen(true)}
          className="rounded-xl border border-line px-3 py-1">
          <Text className="text-xs font-medium text-ink">Log weight</Text>
        </Pressable>
      </View>

      {/* Latest reading subtitle */}
      {latest !== undefined && (
        <Text className="mb-2 text-xs text-ink-soft">
          Latest: {formatWeight(latest.weightKg, profile.displayWeightUnit)} ·{' '}
          {relativeDate(latest.loggedAt)}
        </Text>
      )}

      <WeightChart weights={weights} />

      <View className="mt-2">
        <PeriodChips options={WEIGHT_PERIODS} value={period} onChange={onPeriodChange} />
      </View>

      <LogWeightSheet visible={logOpen} onClose={() => setLogOpen(false)} profile={profile} />
    </View>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns a human-readable relative date string for a Weight's loggedAt ISO timestamp. */
function relativeDate(iso: string): string {
  const now = new Date();
  const then = new Date(iso);
  // Diff in whole local days (strip time by comparing date parts).
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thenDay = new Date(then.getFullYear(), then.getMonth(), then.getDate());
  const diffMs = nowDay.getTime() - thenDay.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays >= 2 && diffDays <= 7) return `${diffDays} days ago`;
  return then.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
