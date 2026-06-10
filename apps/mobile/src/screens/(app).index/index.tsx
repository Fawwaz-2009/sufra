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
import { authClient } from '@/client/auth-client';
import { queryClient } from '@/client/query-client';
import { formatLocalDate, todayLocal, todayRangeUtc } from '@/lib/date';
import { prepareMealPhoto } from '@/lib/meal-photo';
import { snapshotFor } from '@sufra-web/worker/views/derive.ts';

import { MealCard } from './components/meal-card';
import { SummaryPanel, type RingMode } from './components/summary-panel';
import { buildSummary } from './helpers';

const mealsKey = ['meals', 'today'] as const;
const meKey = ['me'] as const;

export default function TodayScreen() {
  const query = useQueryClient();
  const [ringMode, setRingMode] = useState<RingMode>('remaining');

  const meQuery = useQuery({
    queryKey: meKey,
    queryFn: async () => run((await getClient()).me.show()),
  });

  const mealsQuery = useQuery({
    queryKey: mealsKey,
    queryFn: async () => {
      const { from, to } = todayRangeUtc();
      return run((await getClient()).meals.index({ query: { from, to } }));
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (asset: ImagePicker.ImagePickerAsset) => {
      const photo = await prepareMealPhoto(asset);
      return run((await getClient()).meals.create({ payload: { photo } }));
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

  const meals = mealsQuery.data ?? [];
  const activeProfile = useMemo(() => {
    const profiles = meQuery.data?.profiles ?? [];
    return snapshotFor(profiles, formatLocalDate(todayLocal()));
  }, [meQuery.data?.profiles]);
  const summary = activeProfile ? buildSummary(meals, activeProfile) : null;
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

  async function signOut() {
    await authClient.signOut();
    queryClient.clear();
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
        <View className="items-center gap-1 pb-1">
          <Text className="text-base font-semibold text-black">Today</Text>
          <Text className="text-sm text-zinc-500">
            {new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' }).format(
              new Date()
            )}
          </Text>
        </View>

        <SummaryPanel
          ringMode={ringMode}
          setRingMode={setRingMode}
          summary={summary}
        />

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
        ) : meals.length === 0 ? (
          <View className="items-center gap-2 rounded-xl bg-zinc-100 px-6 py-12">
            <Text className="font-medium text-black">No meals logged yet</Text>
            <Text className="text-center text-sm text-zinc-500">
              Tap Take photo to photograph your first one.
            </Text>
          </View>
        ) : (
          <View className="gap-3">
            {meals.map((meal) => (
              <MealCard key={meal.id} meal={meal} />
            ))}
          </View>
        )}

        <Pressable
          onPress={signOut}
          className="mt-4 h-12 w-40 items-center justify-center rounded-[9999px] border border-zinc-300">
          <Text className="text-base font-medium text-zinc-700">Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
