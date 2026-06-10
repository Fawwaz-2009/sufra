import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
import { prepareMealPhoto } from '@/lib/meal-photo';
import { snapshotFor } from '@sufra-web/worker/views/derive.ts';
import { MealCard } from '@/components/meal-card';

import { DayHeader } from './components/day-header';
import { DayStrip } from './components/day-strip';
import { SavedMealsSheet } from './components/saved-meals-sheet';
import { SummaryPanel, type RingMode } from './components/summary-panel';
import { buildSummary } from './helpers';

export default function TodayScreen() {
  const query = useQueryClient();
  const [ringMode, setRingMode] = useState<RingMode>('remaining');
  // Selected day is screen state, not URL state — there is no URL on native.
  const [selectedDay, setSelectedDay] = useState<Date>(() => todayLocal());
  const [savedSheetOpen, setSavedSheetOpen] = useState(false);

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
          payload: { photo, ...(capturedAt ? { capturedAt } : {}) },
        })
      );
    },
    onSuccess: () => query.invalidateQueries({ queryKey: ['meals'] }),
    onError: (error: unknown) => {
      const message =
        typeof (error as { message?: unknown })?.message === 'string'
          ? (error as { message: string }).message
          : "Couldn't save that meal. Try again in a moment.";
      Alert.alert('Meal not saved', message);
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

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera access required', 'Allow camera access to log a Meal from a photo.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 1,
      allowsEditing: false,
    });
    uploadPickedAsset(result);
  }

  async function pickFromLibrary() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access required', 'Allow photo access to choose a Meal photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      allowsEditing: false,
    });
    uploadPickedAsset(result);
  }

  function uploadPickedAsset(result: ImagePicker.ImagePickerResult) {
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;
    uploadMutation.mutate(asset);
  }

  return (
    // className does not reach SafeAreaView — react-native-css only wraps SafeAreaProvider
    <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="mx-auto w-full max-w-md gap-4 px-5 pb-28 pt-4"
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

        <View className="flex-row gap-3">
          <Pressable
            disabled={uploadMutation.isPending}
            onPress={takePhoto}
            className="h-12 flex-1 items-center justify-center rounded-[9999px] bg-emerald-800 px-4">
            <Text className="text-base font-semibold text-white">
              {uploadMutation.isPending ? 'Estimating...' : 'Take photo'}
            </Text>
          </Pressable>
          <Pressable
            disabled={uploadMutation.isPending}
            onPress={pickFromLibrary}
            className="h-12 flex-1 items-center justify-center rounded-[9999px] border border-zinc-300 px-4">
            <Text className="text-base font-medium text-zinc-700">
              Choose from library
            </Text>
          </Pressable>
        </View>
        <Pressable
          onPress={() => setSavedSheetOpen(true)}
          className="h-12 w-full items-center justify-center rounded-[9999px] border border-zinc-300 px-4">
          <Text className="text-base font-medium text-zinc-700">From saved</Text>
        </Pressable>
        <SavedMealsSheet
          visible={savedSheetOpen}
          onClose={() => setSavedSheetOpen(false)}
          capturedAt={isViewingToday ? undefined : localDateForCapture(selectedDay)}
        />

        <View className="mt-2 flex-row items-center justify-between">
          <Text className="text-xs font-bold uppercase text-zinc-500">Meals</Text>
          {uploadMutation.isPending ? (
            <Text className="text-xs text-zinc-500">Estimating...</Text>
          ) : null}
        </View>

        {mealsQuery.isLoading ? (
          <View className="items-center py-10">
            <ActivityIndicator />
          </View>
        ) : mealsForSelectedDay.length === 0 ? (
          <View className="items-center gap-2 rounded-xl bg-zinc-100 px-6 py-12">
            <Text className="font-medium text-black">
              {isViewingToday ? 'No meals logged yet' : 'No meals logged this day.'}
            </Text>
            {isViewingToday ? (
              <Text className="text-center text-sm text-zinc-500">
                Tap Take photo to photograph your first one.
              </Text>
            ) : null}
          </View>
        ) : (
          <View className="gap-3">
            {mealsForSelectedDay.map((meal) => (
              <MealCard key={meal.id} meal={meal} />
            ))}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}
