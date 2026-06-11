import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getClient, run } from '@/client/api-client';
import { DisplayText } from '@/components/display-text';
import { Palette } from '@/constants/theme';
import type { MealView } from '@sufra-web/worker/views/meal.ts';
import { estimateErrorMessage, resolveTotals } from '@sufra-web/worker/views/meal.ts';
import type { MealOverride } from '@sufra-web/worker/models/meal.ts';

import { FoodsBreakdown } from './components/foods-breakdown';
import { MealPhoto } from './components/meal-photo';
import { mealDetailKey, mealQueryOptions, savedMealsKey, savedMealMutationFn } from './queries';

type OverrideKey = 'kcal' | 'proteinG' | 'carbsG' | 'fatG';
const OVERRIDE_KEYS: readonly OverrideKey[] = ['kcal', 'proteinG', 'carbsG', 'fatG'];

export default function MealDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const mealQuery = useQuery(mealQueryOptions(id));
  const meal = mealQuery.data;

  const onSaved = () => {
    void queryClient.invalidateQueries({ queryKey: mealDetailKey(id) });
    void queryClient.invalidateQueries({ queryKey: ['meals'] });
    void queryClient.invalidateQueries({ queryKey: ['me'] });
  };

  if (mealQuery.isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Palette.white }}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );
  }

  if (!meal) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Palette.white }}>
        <View className="flex-1 items-center justify-center px-6 gap-4">
          <Text className="text-lg font-semibold text-ink">Meal not found</Text>
          <Pressable
            onPress={() => router.back()}
            className="h-12 items-center justify-center rounded-[9999px] bg-surface px-6">
            <Text className="text-base font-medium text-ink">Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const time = new Date(meal.capturedAt).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Palette.white }}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-12">
        {/* Close handle for formSheet */}
        <View className="items-center py-2">
          <View className="h-1 w-10 rounded-[9999px] bg-track" />
        </View>

        <MealPhoto meal={meal} onChanged={onSaved} />

        <View className="gap-4 px-5 pt-4">
          <View className="flex-row items-start justify-between gap-3">
            <View className="min-w-0 flex-1">
              <DisplayText className="text-2xl text-ink">
                {meal.aiAnalysis ? meal.aiAnalysis.dishName : "Couldn't read this meal"}
              </DisplayText>
              <Text className="text-sm text-ink-soft">{time}</Text>
            </View>
            <BookmarkButton mealId={meal.id} saved={meal.savedAt != null} />
          </View>

          {/* A text-created Meal shows what the Member wrote — the description IS its source material
              (CONTEXT "User text"); the Improve sheet prefills the same text. */}
          {meal.hasPhoto === false && meal.lastRefinementText ? (
            <Text className="text-sm text-ink-soft">“{meal.lastRefinementText}”</Text>
          ) : null}

          {meal.aiAnalysis ? (
            <>
              <OverrideEditor meal={meal} analysis={meal.aiAnalysis} onSaved={onSaved} />
              <FoodsBreakdown
                mealId={meal.id}
                analysis={meal.aiAnalysis}
                lastRefinementText={meal.lastRefinementText}
                onRefined={onSaved}
              />
            </>
          ) : (
            <RetryPanel mealId={meal.id} errorCode={meal.latestErrorCode} onRetried={onSaved} />
          )}

          <DeleteButton mealId={meal.id} onDeleted={() => router.back()} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// BookmarkButton — Saved Meal toggle (POST save / DELETE unsave, ADR 0012)
// ---------------------------------------------------------------------------

function BookmarkButton({ mealId, saved }: { mealId: string; saved: boolean }) {
  const queryClient = useQueryClient();

  const toggle = useMutation({
    mutationKey: ['meal', mealId, 'saved'],
    mutationFn: savedMealMutationFn(mealId, saved),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: mealDetailKey(mealId) });
      void queryClient.invalidateQueries({ queryKey: savedMealsKey() });
    },
  });

  return (
    <Pressable
      onPress={() => toggle.mutate()}
      disabled={toggle.isPending}
      accessibilityRole="button"
      accessibilityLabel={saved ? 'Remove from saved meals' : 'Save meal for re-logging'}
      accessibilityState={{ selected: saved }}
      className={`h-9 items-center justify-center rounded-[9999px] px-3${toggle.isPending ? ' opacity-50' : ''}`}>
      <Text className={`text-xs font-semibold${saved ? ' text-flame' : ' text-ink-soft'}`}>
        {saved ? 'Saved' : 'Save'}
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// OverrideEditor — override-first Totals with put/delete (ADR 0012)
// ---------------------------------------------------------------------------

function OverrideEditor({
  meal,
  analysis,
  onSaved,
}: {
  meal: MealView;
  analysis: NonNullable<MealView['aiAnalysis']>;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<Record<OverrideKey, string>>(() =>
    overrideToInputs(meal.override)
  );

  const mutation = useMutation({
    mutationKey: ['meal', meal.id, 'override'],
    mutationFn: async (override: MealOverride) => {
      const client = await getClient();
      if (Object.keys(override).length === 0) {
        return run(client.override.destroy({ params: { id: meal.id } }));
      }
      return run(client.override.update({ params: { id: meal.id }, payload: override }));
    },
    onSuccess: (_data, override) => {
      setDraft(overrideToInputs(override));
      onSaved();
    },
  });

  const aiSum = resolveTotals(analysis, null);
  const resolved = resolveTotals(analysis, meal.override);

  return (
    <View className="rounded-2xl bg-surface p-4 gap-3">
      <View className="flex-row items-baseline justify-between">
        <Text className="text-xs font-bold uppercase text-ink-soft">Your numbers</Text>
        <View className="flex-row items-baseline gap-1">
          <DisplayText style={{ fontSize: 34, lineHeight: 38 }} className="text-ink">
            {Math.round(resolved.kcal)}
          </DisplayText>
          <Text className="text-sm text-ink-soft">kcal</Text>
        </View>
      </View>

      <View className="flex-row flex-wrap gap-3">
        <OverrideField
          label="Calories"
          unit="kcal"
          value={draft.kcal}
          aiValue={aiSum.kcal}
          onChange={(v) => setDraft((d) => ({ ...d, kcal: v }))}
        />
        <OverrideField
          label="Protein"
          unit="g"
          value={draft.proteinG}
          aiValue={aiSum.proteinG}
          onChange={(v) => setDraft((d) => ({ ...d, proteinG: v }))}
        />
        <OverrideField
          label="Carbs"
          unit="g"
          value={draft.carbsG}
          aiValue={aiSum.carbsG}
          onChange={(v) => setDraft((d) => ({ ...d, carbsG: v }))}
        />
        <OverrideField
          label="Fat"
          unit="g"
          value={draft.fatG}
          aiValue={aiSum.fatG}
          onChange={(v) => setDraft((d) => ({ ...d, fatG: v }))}
        />
      </View>

      <View className="flex-row gap-2">
        <Pressable
          onPress={() => mutation.mutate(inputsToOverride(draft))}
          disabled={mutation.isPending}
          className={`h-12 flex-1 items-center justify-center rounded-[9999px] bg-flame${mutation.isPending ? ' opacity-60' : ''}`}>
          <Text className="text-base font-semibold text-white">
            {mutation.isPending ? 'Saving...' : 'Save'}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setDraft({ kcal: '', proteinG: '', carbsG: '', fatG: '' })}
          disabled={mutation.isPending}
          className="h-12 items-center justify-center rounded-[9999px] bg-surface px-4">
          <Text className="text-sm font-medium text-ink">Reset</Text>
        </Pressable>
      </View>
      {mutation.isError ? (
        <Text className="text-xs text-red">{"Couldn't save. Try again."}</Text>
      ) : null}
    </View>
  );
}

function OverrideField({
  label,
  unit,
  value,
  aiValue,
  onChange,
}: {
  label: string;
  unit: string;
  value: string;
  aiValue: number;
  onChange: (v: string) => void;
}) {
  return (
    <View style={{ width: '47%' }} className="gap-1">
      <Text className="text-xs text-ink-soft">
        {label} · AI: {Math.round(aiValue)}
        {unit}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={String(Math.round(aiValue))}
        placeholderTextColor={Palette.inkFaint}
        keyboardType="decimal-pad"
        className="rounded-xl bg-surface"
        style={{
          paddingHorizontal: 10,
          paddingVertical: 8,
          fontSize: 14,
          color: Palette.ink,
        }}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// RetryPanel — shown when the current Estimate failed (ADR 0017)
// ---------------------------------------------------------------------------

function RetryPanel({
  mealId,
  errorCode,
  onRetried,
}: {
  mealId: string;
  errorCode: string | null;
  onRetried: () => void;
}) {
  const retry = useMutation({
    mutationKey: ['meal', mealId, 'retry'],
    mutationFn: async () =>
      run((await getClient()).estimates.create({ params: { id: mealId }, payload: {} })),
    onSuccess: onRetried,
  });

  return (
    <View className="rounded-2xl bg-surface p-4 gap-3">
      <Text className="text-sm text-ink-soft">{estimateErrorMessage(errorCode)}</Text>
      <Pressable
        onPress={() => retry.mutate()}
        disabled={retry.isPending}
        className={`h-12 items-center justify-center rounded-[9999px] bg-flame${retry.isPending ? ' opacity-60' : ''}`}>
        {retry.isPending ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text className="text-base font-semibold text-white">Retry estimate</Text>
        )}
      </Pressable>
      {retry.isError ? (
        <Text className="text-xs text-red">
          {"Still couldn't reach the vision service. Try again."}
        </Text>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// DeleteButton — native Alert confirm → navigate back → invalidate (ADR 0017)
// ---------------------------------------------------------------------------

function DeleteButton({ mealId, onDeleted }: { mealId: string; onDeleted: () => void }) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationKey: ['meal', mealId, 'delete'],
    mutationFn: async () =>
      run((await getClient()).meals.destroy({ params: { id: mealId } })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['meals'] });
      onDeleted();
    },
  });

  const confirm = () => {
    Alert.alert('Delete meal', 'This will permanently remove this meal and its photo.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteMutation.mutate(),
      },
    ]);
  };

  return (
    <View className="mt-2">
      <Pressable
        onPress={confirm}
        disabled={deleteMutation.isPending}
        className="h-12 items-center justify-center">
        <Text className="text-base font-medium text-red">
          {deleteMutation.isPending ? 'Deleting...' : 'Delete meal'}
        </Text>
      </Pressable>
      {deleteMutation.isError ? (
        <Text className="text-xs text-red mt-2">{"Couldn't delete. Try again."}</Text>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function overrideToInputs(override: MealOverride | null): Record<OverrideKey, string> {
  return {
    kcal: override?.kcal != null ? String(override.kcal) : '',
    proteinG: override?.proteinG != null ? String(override.proteinG) : '',
    carbsG: override?.carbsG != null ? String(override.carbsG) : '',
    fatG: override?.fatG != null ? String(override.fatG) : '',
  };
}

function inputsToOverride(draft: Record<OverrideKey, string>): MealOverride {
  const out: { -readonly [K in OverrideKey]?: number } = {};
  for (const k of OVERRIDE_KEYS) {
    const raw = draft[k]?.trim();
    if (!raw) continue;
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) out[k] = n;
  }
  return out;
}
