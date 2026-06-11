/**
 * CaloriesChart — SVG bar chart, one bar per bucket (day for 7D/30D, week-avg for 90D,
 * month-avg for 1Y). Ports apps/web/src/routes/progress/-components/calories-chart.tsx.
 * Bar color comes from the SERVER (computed against the historical per-day Target).
 */

import React, { useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';

import { Palette } from '@/constants/theme';

import type { CalorieHistoryBucketView } from '@sufra-web/worker/views/calorie-history.ts';

import type { CaloriePeriod } from '../helpers';

export function CaloriesChart({
  buckets,
  period,
}: {
  buckets: readonly CalorieHistoryBucketView[];
  period: CaloriePeriod;
}) {
  const [width, setWidth] = useState(0);

  return (
    <View style={{ height: 200 }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {buckets.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text className="text-xs text-ink-soft">No meals logged in this period.</Text>
        </View>
      ) : width > 0 ? (
        <CaloriesChartInner buckets={buckets} period={period} width={width} />
      ) : null}
    </View>
  );
}

// ─── Inner chart (rendered once width is known) ───────────────────────────────

function CaloriesChartInner({
  buckets,
  period,
  width,
}: {
  buckets: readonly CalorieHistoryBucketView[];
  period: CaloriePeriod;
  width: number;
}) {
  const dims = { height: 200, padL: 36, padR: 12, padT: 12, padB: 28 };
  const { height, padL, padR, padT, padB } = dims;

  const ys = buckets.map((b) => b.kcalAvg);
  const targets = buckets.map((b) => b.targetAvg).filter((t) => t > 0);
  const baseMax = Math.max(...ys, ...targets, 0);
  // Round up to the nearest 600 so y-ticks are clean (the 600/1200/1800/2400 ladder).
  const yMax = Math.max(600, Math.ceil(baseMax / 600) * 600);

  const step = yMax / 4;
  const yTicks = [0, step, step * 2, step * 3, step * 4];

  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const yFor = (t: number) => padT + (1 - t / yMax) * plotH;

  const slot = plotW / buckets.length;
  const barW = Math.min(slot * 0.7, 32);
  const barOffset = (slot - barW) / 2;

  return (
    <Svg width={width} height={height}>
      {/* Y gridlines + tick labels */}
      {yTicks.map((t, i) => (
        <React.Fragment key={`y-${i}`}>
          <Line
            x1={padL}
            x2={width - padR}
            y1={yFor(t)}
            y2={yFor(t)}
            stroke={Palette.line}
            strokeDasharray="2,3"
          />
          <SvgText x={0} y={yFor(t) + 4} fontSize={10} fill={Palette.inkSoft}>
            {t}
          </SvgText>
        </React.Fragment>
      ))}

      {/* Bars + sparse x labels */}
      {buckets.map((b, i) => {
        const x = padL + slot * i + barOffset;
        const h = b.kcalAvg > 0 ? (b.kcalAvg / yMax) * plotH : 0;
        const y = padT + (plotH - h);
        const { fill, opacity } = barColor(b.color);
        return (
          <React.Fragment key={b.bucketStart}>
            <Rect x={x} y={y} width={barW} height={h} rx={3} fill={fill} fillOpacity={opacity} />
            {shouldLabel(period, i, buckets.length) && (
              <SvgText
                x={x + barW / 2}
                y={height - 8}
                fontSize={10}
                fill={Palette.inkSoft}
                textAnchor="middle">
                {formatBucketLabel(b.bucketStart, period)}
              </SvgText>
            )}
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function barColor(color: CalorieHistoryBucketView['color']): { fill: string; opacity: number } {
  if (color === 'ok') return { fill: Palette.teal, opacity: 0.8 };
  if (color === 'warn') return { fill: Palette.amber, opacity: 0.8 };
  if (color === 'over') return { fill: Palette.red, opacity: 0.8 };
  return { fill: Palette.ink, opacity: 0.06 };
}

/** X-axis labels only every Nth bar for dense periods so they stay readable. */
function shouldLabel(period: CaloriePeriod, i: number, n: number): boolean {
  if (period === '7D') return true;
  if (period === '30D') return i % 5 === 0 || i === n - 1;
  if (period === '90D') return i % 2 === 0 || i === n - 1;
  return true; // 1Y: 12 month buckets, label them all
}

function formatBucketLabel(bucketStart: string, period: CaloriePeriod): string {
  // Parse "YYYY-MM-DD" by parts to keep the bucket's LOCAL day (Date.parse would shift via UTC).
  const p = bucketStart.split('-');
  const date = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  if (period === '7D') return date.toLocaleDateString(undefined, { weekday: 'short' });
  if (period === '1Y') return date.toLocaleDateString(undefined, { month: 'short' });
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
