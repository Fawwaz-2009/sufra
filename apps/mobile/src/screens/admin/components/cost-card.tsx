/**
 * Inference cost summary card for the current calendar month.
 * Port of apps/web/src/routes/admin/-components/cost-card.tsx.
 */

import { Text, View } from 'react-native';

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
    <View className="rounded-2xl border border-zinc-200 bg-white p-4">
      <Text className="text-sm text-zinc-500">Inference cost this month</Text>
      <View className="mt-1 flex-row items-baseline justify-between gap-2">
        <Text className="text-2xl font-semibold text-black">{`$${totalUsd.toFixed(2)}`}</Text>
        <Text className="text-xs text-zinc-500">{`~$${perMemberAvgUsd.toFixed(2)} / member`}</Text>
      </View>
      <Text className="mt-1 text-xs text-zinc-500">
        {runCount} {runCount === 1 ? 'run' : 'runs'}
      </Text>
    </View>
  );
}
