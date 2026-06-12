/**
 * Inference cost summary card for the current calendar month.
 * Port of apps/web/src/routes/admin/-components/cost-card.tsx.
 */

import { plural, t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
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
      <Text className="text-sm text-ink-soft">
        <Trans>Inference cost this month</Trans>
      </Text>
      <View className="mt-1 flex-row items-baseline justify-between gap-2">
        <DisplayText className="text-2xl text-ink">{`$${totalUsd.toFixed(2)}`}</DisplayText>
        <Text className="text-xs text-ink-soft">{t`~$${perMemberAvgUsd.toFixed(2)} / member`}</Text>
      </View>
      <Text className="mt-1 text-xs text-ink-soft">
        {plural(runCount, { one: '# run', other: '# runs' })}
      </Text>
    </View>
  );
}
