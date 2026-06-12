import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Pressable } from '@/components/pressable';
import { SafeAreaView } from 'react-native-safe-area-context';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';

import { Palette } from '@/constants/theme';

import { getClient, run } from '@/client/api-client';
import { meQueryOptions } from '@/client/me';
import {
  addDays,
  diffInLocalDays,
  formatLocalDate,
  isSameLocalDay,
  localDateForCapture,
  selectedDayLabel,
  todayLocal,
  weekRange,
  weekStart,
} from '@/lib/date';
import { haptics } from '@/lib/haptics';
import { getLocale } from '@/lib/locale';
import { prepareMealPhoto } from '@/lib/meal-photo';
import { pickMealPhotoAsset } from '@/lib/photo-source';
import { snapshotFor } from '@sufra-web/worker/views/derive.ts';
import { MealCard } from '@/components/meal-card';

import { DayHeader } from './components/day-header';
import { DayStrip } from './components/day-strip';
import { DescribeSheet } from './components/describe-sheet';
import { SavedMealsSheet } from './components/saved-meals-sheet';
import { SummaryPanel, type RingMode } from './components/summary-panel';
import { buildSummary } from './helpers';

export default function TodayScreen() {
  const query = useQueryClient();
  const [ringMode, setRingMode] = useState<RingMode>('remaining');
  // Selected day is screen state, not URL state — there is no URL on native.
  const [selectedDay, setSelectedDay] = useState<Date>(() => todayLocal());
  const [savedSheetOpen, setSavedSheetOpen] = useState(false);
  const [describeOpen, setDescribeOpen] = useState(false);

  const today = todayLocal();
  const ws = weekStart(selectedDay);

  const meQuery = useQuery(meQueryOptions());

  // Fetch the whole week and filter to the selected Day client-side — the web's choice;
  // navigating within a week stays warm, only a week flip refetches.
  const mealsQuery = useQuery({
    queryKey: ['meals', 'week', formatLocalDate(ws)],
    queryFn: async () => {
      const { from, to } = weekRange(ws);
      return run((await getClient()).meals.index({ query: { from, to } }));
    },
  });

  const isViewingToday = isSameLocalDay(selectedDay, today);
  const canGoNext = diffInLocalDays(selectedDay, today) < 0;

  const goPrevWeek = () => setSelectedDay(addDays(selectedDay, -7));
  const goNextWeek = () => {
    const next = addDays(selectedDay, 7);
    setSelectedDay(diffInLocalDays(next, today) > 0 ? today : next);
  };

  const uploadMutation = useMutation({
    mutationFn: async (asset: ImagePicker.ImagePickerAsset) => {
      const photo = await prepareMealPhoto(asset);
      // Capturing on a past Day backdates the meal into that Day (noon-anchored).
      const capturedAt = isViewingToday ? undefined : localDateForCapture(selectedDay);
      return run(
        (await getClient()).meals.create({
          payload: { photo, locale: getLocale(), ...(capturedAt ? { capturedAt } : {}) },
        })
      );
    },
    onSuccess: () => {
      haptics.success();
      return query.invalidateQueries({ queryKey: ['meals'] });
    },
    onError: (error: unknown) => {
      haptics.warning();
      const message =
        typeof (error as { message?: unknown })?.message === 'string'
          ? (error as { message: string }).message
          : t`Couldn't save that meal. Try again in a moment.`;
      Alert.alert(t`Meal not saved`, message);
    },
  });

  const mealsForSelectedDay = (mealsQuery.data ?? []).filter((m) =>
    isSameLocalDay(new Date(m.capturedAt), selectedDay)
  );
  // The snapshot ACTIVE ON the selected Day drives the summary — past Days show their
  // historical Target (ADR 0002/0003).
  const daySnapshot = useMemo(() => {
    const profiles = meQuery.data?.profiles ?? [];
    return snapshotFor(profiles, formatLocalDate(selectedDay));
  }, [meQuery.data?.profiles, selectedDay]);
  const summary = daySnapshot ? buildSummary(mealsForSelectedDay, daySnapshot) : null;
  // No snapshot + no profiles at all = not onboarded (the panel's setup copy). No snapshot on a
  // Day BEFORE the first snapshot = hide the panel, like web — the Member is onboarded.
  const isOnboarded = (meQuery.data?.profiles.length ?? 0) > 0;
  const refreshing = meQuery.isRefetching || mealsQuery.isRefetching;

  // The photo door — ONE button, the native action sheet folds the library into it (ADR 0019 entry).
  async function logFromPhoto() {
    const asset = await pickMealPhotoAsset();
    if (asset) uploadMutation.mutate(asset);
  }

  return (
    // className does not reach SafeAreaView — react-native-css only wraps SafeAreaProvider
    <SafeAreaView style={{ flex: 1, backgroundColor: Palette.white }}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="mx-auto w-full max-w-md sm:max-w-2xl gap-4 px-5 pb-28 pt-4"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void meQuery.refetch();
              void mealsQuery.refetch();
            }}
          />
        }>
        <DayHeader
          label={selectedDayLabel(selectedDay, today)}
          onPrev={goPrevWeek}
          onNext={goNextWeek}
          canGoNext={canGoNext}
        />
        <DayStrip
          weekStartDate={ws}
          selectedDay={selectedDay}
          today={today}
          onSelect={setSelectedDay}
        />

        {!isOnboarded || summary ? (
          <SummaryPanel ringMode={ringMode} setRingMode={setRingMode} summary={summary} />
        ) : null}

        {/* The three creation doors (ADR 0019), all visible — photo is the hot path, the action sheet
            folds the library into it; Describe and From saved are peer buttons, not buried links. */}
        <Pressable
          disabled={uploadMutation.isPending}
          onPress={() => void logFromPhoto()}
          className="h-12 w-full items-center justify-center rounded-[9999px] bg-flame">
          <Text className="text-[17px] font-semibold text-white">
            {uploadMutation.isPending ? <Trans>Estimating...</Trans> : <Trans>Photo</Trans>}
          </Text>
        </Pressable>
        <View className="flex-row gap-3">
          <Pressable
            disabled={uploadMutation.isPending}
            onPress={() => setDescribeOpen(true)}
            className="h-12 flex-1 items-center justify-center rounded-[9999px] bg-surface">
            <Text className="text-base font-medium text-flame-deep"><Trans>Describe</Trans></Text>
          </Pressable>
          <Pressable
            disabled={uploadMutation.isPending}
            onPress={() => setSavedSheetOpen(true)}
            className="h-12 flex-1 items-center justify-center rounded-[9999px] bg-surface">
            <Text className="text-base font-medium text-flame-deep"><Trans>From saved</Trans></Text>
          </Pressable>
        </View>

        <DescribeSheet
          visible={describeOpen}
          onClose={() => setDescribeOpen(false)}
          capturedAt={isViewingToday ? undefined : localDateForCapture(selectedDay)}
        />
        <SavedMealsSheet
          visible={savedSheetOpen}
          onClose={() => setSavedSheetOpen(false)}
          capturedAt={isViewingToday ? undefined : localDateForCapture(selectedDay)}
        />

        {/* Meals label */}
        <View className="mt-2 flex-row items-center justify-between">
          <Text className="text-xs font-bold uppercase text-ink-soft"><Trans>Meals</Trans></Text>
        </View>

        {/* While the photo path estimates, a placeholder card holds the new meal's place at the top
            of the list (and suppresses the empty state) — the multi-second AI wait has a stage. */}
        {mealsQuery.isLoading ? (
          <View className="items-center py-10">
            <ActivityIndicator />
          </View>
        ) : mealsForSelectedDay.length === 0 && !uploadMutation.isPending ? (
          <View className="items-center gap-2 py-12">
            <Image
              source={require('@/assets/images/sufra-circle.png')}
              style={{ width: 56, height: 56, opacity: 0.4 }}
            />
            <Text className="text-base font-semibold text-ink">
              {isViewingToday ? <Trans>No meals logged yet</Trans> : <Trans>No meals logged this day.</Trans>}
            </Text>
            {isViewingToday ? (
              <Text className="text-center text-sm text-ink-soft">
                <Trans>Log your first one — snap a photo or describe it.</Trans>
              </Text>
            ) : null}
          </View>
        ) : (
          <View className="gap-3">
            {uploadMutation.isPending ? <EstimatingCard /> : null}
            {mealsForSelectedDay.map((meal) => (
              <MealCard key={meal.id} meal={meal} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** The pending Meal's stand-in — the MealCard frame (media area + title row) so the list doesn't
 *  reflow when the real card replaces it. */
function EstimatingCard() {
  return (
    <View className="w-full overflow-hidden rounded-2xl border border-line bg-white">
      <View
        className="w-full items-center justify-center"
        style={{ height: 190, backgroundColor: Palette.track }}>
        <ActivityIndicator />
      </View>
      <View className="px-3 pt-2 pb-3">
        <Text className="text-[17px] font-semibold text-ink-soft"><Trans>Estimating...</Trans></Text>
      </View>
    </View>
  );
}
