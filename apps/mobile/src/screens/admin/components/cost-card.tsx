/**
 * Inference cost summary card for the current calendar month.
 * Port of apps/web/src/routes/admin/-components/cost-card.tsx.
 */

import { Text, View } from 'react-native';
import { DisplayText } from '@/components/display-text';

export function CostCard({
  totalUsd,
  perMemberAvgUsd,
  runCount,
}: {
  totalUsd: number;
  perMemberAvgUsd: number;
  runCount: number;
}) {
  return (
    <View className="rounded-2xl border border-line bg-white p-4">
      <Text className="text-sm text-ink-soft">Inference cost this month</Text>
      <View className="mt-1 flex-row items-baseline justify-between gap-2">
        <DisplayText className="text-2xl text-ink">{`$${totalUsd.toFixed(2)}`}</DisplayText>
        <Text className="text-xs text-ink-soft">{`~$${perMemberAvgUsd.toFixed(2)} / member`}</Text>
      </View>
      <Text className="mt-1 text-xs text-ink-soft">
        {runCount} {runCount === 1 ? 'run' : 'runs'}
      </Text>
    </View>
  );
}
