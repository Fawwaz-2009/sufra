/**
 * CaloriesCard — card showing the Calorie history bar chart with a period picker and the
 * period's average intake. Ports apps/web/src/routes/progress/-components/calories-card.tsx.
 */

import { useQuery } from '@tanstack/react-query';
import { Text, View } from 'react-native';

import {
  CALORIE_PERIODS,
  calorieHistoryQueryOptions,
  type CaloriePeriod,
} from '../helpers';
import { CaloriesChart } from './calories-chart';
import { PeriodChips } from './period-chips';

export function CaloriesCard({
  period,
  onPeriodChange,
}: {
  period: CaloriePeriod;
  onPeriodChange: (p: CaloriePeriod) => void;
}) {
  const { data } = useQuery(calorieHistoryQueryOptions(period));
  const buckets = data ?? [];

  // Weighted average across buckets: kcalAvg is per-day-with-data, so weight by daysWithData.
  const daysWithData = buckets.reduce((acc, b) => acc + b.daysWithData, 0);
  const totalKcal = buckets.reduce((acc, b) => acc + b.kcalAvg * b.daysWithData, 0);
  const avgDaily = daysWithData > 0 ? Math.round(totalKcal / daysWithData) : 0;

  return (
    <View className="rounded-2xl border border-zinc-200 bg-white p-4">
      <Text className="text-base font-semibold text-black">Calories</Text>
      <Text className="mb-2 text-xs text-zinc-500">
        {daysWithData > 0
          ? `Avg ${avgDaily.toLocaleString()} kcal/day · ${periodLabel(period)}`
          : `No meals · ${periodLabel(period)}`}
      </Text>

      <CaloriesChart buckets={buckets} period={period} />

      <View className="mt-2">
        <PeriodChips options={CALORIE_PERIODS} value={period} onChange={onPeriodChange} />
      </View>
    </View>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function periodLabel(p: CaloriePeriod): string {
  switch (p) {
    case '7D':
      return 'last 7 days';
    case '30D':
      return 'last 30 days';
    case '90D':
      return 'last 90 days';
    case '1Y':
      return 'last year';
  }
}
