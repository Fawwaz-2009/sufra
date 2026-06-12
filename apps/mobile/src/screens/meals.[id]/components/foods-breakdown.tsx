import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { Analysis } from '@sufra-web/worker/models/estimate.ts';
import { ImproveEstimateSheet } from './improve-estimate-sheet';

/**
 * The AI Estimate breakdown — foods list + the "Improve" button that opens the Refinement sheet.
 * Confidence is shown as a color tint on the button (high = muted, medium = amber, low = red),
 * matching the web's affordance (CONTEXT.md "Confidence").
 */
export function FoodsBreakdown({
  mealId,
  analysis,
  lastRefinementText,
  onRefined,
}: {
  mealId: string;
  analysis: Analysis;
  lastRefinementText: string | null;
  onRefined: () => void;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <View className="rounded-2xl bg-surface">
      <View className="flex-row items-center justify-between gap-2 px-4 pt-4 pb-3">
        <Text className="text-xs font-bold uppercase text-ink-soft">
          <Trans>AI estimate</Trans>
        </Text>
        <Pressable
          onPress={() => setSheetOpen(true)}
          accessibilityLabel={t`Improve estimate`}
          className="rounded-[9999px] bg-flame px-3 py-1">
          <Text className="text-xs font-semibold text-white">
            <Trans>Improve</Trans>
          </Text>
        </Pressable>
      </View>

      <View>
        {analysis.foods.map((f, idx) => (
          <View
            key={idx}
            className={`flex-row items-center gap-3 px-4 py-3${idx < analysis.foods.length - 1 ? ' border-b border-line' : ''}`}>
            <View className="min-w-0 flex-1">
              <Text className="text-base text-ink">{f.name}</Text>
              <Text className="text-sm text-ink-soft">
                {f.portionEstimate} {f.portionUnit} · {Math.round(f.portionGrams)}g
              </Text>
            </View>
            <Text className="shrink-0 text-base font-semibold text-ink">
              {Math.round(f.estimatedKcal)}
            </Text>
          </View>
        ))}
      </View>

      <ImproveEstimateSheet
        visible={sheetOpen}
        mealId={mealId}
        clarifications={analysis.clarifications}
        lastRefinementText={lastRefinementText}
        onRefined={() => {
          setSheetOpen(false);
          onRefined();
        }}
        onClose={() => setSheetOpen(false)}
      />
    </View>
  );
}
