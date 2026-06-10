/**
 * Progress screen helpers — period definitions, date-range math, and query-options factories.
 * Ports apps/web/src/routes/progress/-search.ts + -queries.ts, minus zod/URL state (period
 * selection is plain useState on mobile).
 */

import { queryOptions } from '@tanstack/react-query';

import { getClient, run } from '@/client/api-client';

// ─── Period constants ────────────────────────────────────────────────────────

export const WEIGHT_PERIODS = ['1M', '3M', '6M', '1Y'] as const;
export const CALORIE_PERIODS = ['7D', '30D', '90D', '1Y'] as const;

export type WeightPeriod = (typeof WEIGHT_PERIODS)[number];
export type CaloriePeriod = (typeof CALORIE_PERIODS)[number];

export const DEFAULT_WEIGHT_PERIOD: WeightPeriod = '1M';
export const DEFAULT_CALORIE_PERIOD: CaloriePeriod = '7D';

// ─── Bucket resolution ───────────────────────────────────────────────────────

/** Maps a CaloriePeriod to the appropriate aggregation bucket for the calorie-history endpoint. */
export function calorieBucketFor(p: CaloriePeriod): 'day' | 'week' | 'month' {
  if (p === '7D' || p === '30D') return 'day';
  if (p === '90D') return 'week';
  return 'month'; // 1Y
}

// ─── Date-range helpers ───────────────────────────────────────────────────────

/**
 * Returns the ISO-string { from, to } range for the Weight chart.
 * `to` = midnight local tomorrow; `from` = N months before today.
 */
export function weightPeriodRange(
  p: WeightPeriod,
  now = new Date(),
): { from: string; to: string } {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  const to = new Date(y, m, d + 1);

  const monthsBack: Record<WeightPeriod, number> = { '1M': 1, '3M': 3, '6M': 6, '1Y': 12 };
  const from = new Date(y, m - (monthsBack[p] ?? 1), d);

  return { from: from.toISOString(), to: to.toISOString() };
}

/**
 * Returns the ISO-string { from, to } range for the Calorie history chart.
 * `to` = midnight local tomorrow; `from` varies by period.
 */
export function caloriePeriodRange(
  p: CaloriePeriod,
  now = new Date(),
): { from: string; to: string } {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  const to = new Date(y, m, d + 1);

  let from: Date;
  if (p === '7D') {
    from = new Date(y, m, d - 6);
  } else if (p === '30D') {
    from = new Date(y, m, d - 29);
  } else if (p === '90D') {
    from = new Date(y, m, d - 89);
  } else {
    // 1Y
    from = new Date(y - 1, m, d + 1);
  }

  return { from: from.toISOString(), to: to.toISOString() };
}

// ─── Query keys ──────────────────────────────────────────────────────────────

/** Query key prefix for weight series — matches the shape invalidated by LogWeightSheet. */
export const weightsKey = (p: WeightPeriod) => ['weights', p] as const;

/** Query key prefix for calorie history — matches the shape invalidated by LogWeightSheet. */
export const calorieHistoryKey = (p: CaloriePeriod) => ['calorie-history', p] as const;

// ─── Query options factories ──────────────────────────────────────────────────

export function weightsQueryOptions(period: WeightPeriod) {
  const { from, to } = weightPeriodRange(period);
  return queryOptions({
    queryKey: weightsKey(period),
    queryFn: async () => run((await getClient()).weights.index({ query: { from, to } })),
  });
}

export function calorieHistoryQueryOptions(period: CaloriePeriod) {
  const { from, to } = caloriePeriodRange(period);
  const bucket = calorieBucketFor(period);
  const tz =
    typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC';
  return queryOptions({
    queryKey: calorieHistoryKey(period),
    queryFn: async () =>
      run((await getClient()).calorieHistory.index({ query: { from, to, bucket, tz } })),
  });
}
