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

  const improveButtonColor =
    analysis.overallConfidence === 'high'
      ? '#166534'
      : analysis.overallConfidence === 'medium'
        ? '#b45309'
        : '#dc2626';

  return (
    <View className="rounded-xl bg-zinc-100 p-4">
      <View className="flex-row items-center justify-between gap-2">
        <Text className="text-xs font-bold uppercase text-zinc-500">AI estimate</Text>
        <Pressable
          onPress={() => setSheetOpen(true)}
          accessibilityLabel="Improve estimate"
          style={{ borderColor: improveButtonColor, borderWidth: 1, borderRadius: 9999 }}
          className="px-3 py-1">
          <Text style={{ color: improveButtonColor }} className="text-xs font-medium">
            Improve
          </Text>
        </Pressable>
      </View>

      <View className="mt-3 gap-3">
        {analysis.foods.map((f, idx) => (
          <View key={idx} className="flex-row items-start gap-3">
            <View className="min-w-0 flex-1">
              <Text className="text-sm font-medium text-black">{f.name}</Text>
              <Text className="text-xs text-zinc-500">
                {f.portionEstimate} {f.portionUnit} · {Math.round(f.portionGrams)}g
              </Text>
              <Text className="text-xs text-zinc-500">
                P {Math.round(f.estimatedProteinG)}g · C {Math.round(f.estimatedCarbsG)}g · F{' '}
                {Math.round(f.estimatedFatG)}g
              </Text>
            </View>
            <View className="w-16 shrink-0 items-end">
              <Text className="text-sm text-zinc-600">{Math.round(f.estimatedKcal)}</Text>
              <Text className="text-xs text-zinc-500">kcal</Text>
            </View>
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
