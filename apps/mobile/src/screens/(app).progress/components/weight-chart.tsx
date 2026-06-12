/**
 * WeightChart — SVG line chart, one dot per Weight, connected in time order.
 * Ports apps/web/src/routes/progress/-components/weight-chart.tsx.
 * Tap a dot to open a native Alert offering Delete (ADR 0007: Weight rows are
 * user-correctable via delete; profile_snapshots are never touched here).
 */

import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';

import { getClient, run } from '@/client/api-client';
import { displayLocale } from '@/lib/date';
import { haptics } from '@/lib/haptics';
import { Palette } from '@/constants/theme';

type Point = { id: string; weightKg: number; loggedAt: string };

export function WeightChart({ weights }: { weights: readonly Point[] }) {
  const [width, setWidth] = useState(0);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async (id: string) =>
      run((await getClient()).weights.destroy({ params: { id } })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['weights'] });
    },
  });

  const sorted = [...weights].sort((a, b) => (a.loggedAt < b.loggedAt ? -1 : 1));

  const dims = { height: 180, padL: 32, padR: 12, padT: 12, padB: 24 };

  const confirmDelete = (p: Point) => {
    Alert.alert(
      `${p.weightKg.toFixed(1)} kg · ${shortDate(p.loggedAt)}`,
      t`Delete this weight entry?`,
      [
        { text: t`Cancel`, style: 'cancel' },
        {
          text: t`Delete`,
          style: 'destructive',
          onPress: () => {
            haptics.destructive();
            deleteMutation.mutate(p.id);
          },
        },
      ],
    );
  };

  return (
    <View
      style={{ height: 180 }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {sorted.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text className="text-xs text-ink-soft">
            <Trans>No weights logged in this period.</Trans>
          </Text>
        </View>
      ) : width > 0 ? (
        <WeightChartInner
          sorted={sorted}
          width={width}
          dims={dims}
          onDelete={confirmDelete}
        />
      ) : null}
    </View>
  );
}

// ─── Inner chart (rendered once width is known) ───────────────────────────────

interface DimsType {
  height: number;
  padL: number;
  padR: number;
  padT: number;
  padB: number;
}

function WeightChartInner({
  sorted,
  width,
  dims,
  onDelete,
}: {
  sorted: Point[];
  width: number;
  dims: DimsType;
  onDelete: (p: Point) => void;
}) {
  const { height, padL, padR, padT, padB } = dims;

  const ys = sorted.map((p) => p.weightKg);
  const xs = sorted.map((p) => Date.parse(p.loggedAt));

  // 1-kg padding so a flat series doesn't degenerate to a line at the top/bottom.
  const yMin = Math.floor(Math.min(...ys) - 1);
  const yMax = Math.ceil(Math.max(...ys) + 1);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);

  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const xFor = (x: number) =>
    xs.length === 1
      ? padL + plotW / 2
      : padL + ((x - xMin) / (xMax - xMin || 1)) * plotW;

  const yFor = (y: number) => padT + (1 - (y - yMin) / (yMax - yMin || 1)) * plotH;

  const path = sorted
    .map(
      (p, i) =>
        `${i === 0 ? 'M' : 'L'}${xFor(Date.parse(p.loggedAt)).toFixed(2)},${yFor(p.weightKg).toFixed(2)}`,
    )
    .join(' ');

  // Y-axis: 3 ticks (min, mid, max).
  const yTicks = [yMin, Math.round((yMin + yMax) / 2), yMax];

  // X-axis: 3 evenly-spaced date labels.
  const xLabels = xLabelTicks(xs);

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

      {/* X-axis date labels */}
      {xLabels.map((tick, i) => (
        <SvgText
          key={`x-${i}`}
          x={xFor(tick.x)}
          y={height - 4}
          fontSize={10}
          fill={Palette.inkSoft}
          textAnchor="middle">
          {tick.label}
        </SvgText>
      ))}

      {/* Connecting line */}
      {sorted.length > 1 && (
        <Path d={path} fill="none" stroke={Palette.flame} strokeOpacity={1} strokeWidth={2.5} />
      )}

      {/* Dots + hit targets */}
      {sorted.map((p) => {
        const cx = xFor(Date.parse(p.loggedAt));
        const cy = yFor(p.weightKg);
        return (
          <React.Fragment key={p.id}>
            <Circle cx={cx} cy={cy} r={4} fill={Palette.flameDeep} fillOpacity={1} />
            <Circle cx={cx} cy={cy} r={14} fill="transparent" onPress={() => onDelete(p)} />
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(displayLocale(), { month: 'short', day: 'numeric' });
}

function xLabelTicks(xs: number[]): { x: number; label: string }[] {
  if (xs.length === 0) return [];
  const min = Math.min(...xs);
  const max = Math.max(...xs);
  if (min === max) return [{ x: min, label: shortDate(new Date(min).toISOString()) }];
  const mid = (min + max) / 2;
  return [min, mid, max].map((x) => ({ x, label: shortDate(new Date(x).toISOString()) }));
}

