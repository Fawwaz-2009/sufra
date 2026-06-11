/**
 * Progress screen — native counterpart of apps/web/src/routes/progress/index.tsx.
 * Shows the Member's Weight chart, Calorie history chart, and BMI strip, each with
 * a period picker. Data is driven by the same backend endpoints as the web app.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DisplayText } from '@/components/display-text';
import { Palette } from '@/constants/theme';

import { meQueryOptions } from '@/client/me';
import { queryClient } from '@/client/query-client';

import {
  DEFAULT_CALORIE_PERIOD,
  DEFAULT_WEIGHT_PERIOD,
  type CaloriePeriod,
  type WeightPeriod,
} from './helpers';
import { BmiCard } from './components/bmi-card';
import { CaloriesCard } from './components/calories-card';
import { WeightCard } from './components/weight-card';

export default function ProgressScreen() {
  const [wp, setWp] = useState<WeightPeriod>(DEFAULT_WEIGHT_PERIOD);
  const [cp, setCp] = useState<CaloriePeriod>(DEFAULT_CALORIE_PERIOD);

  const meQuery = useQuery(meQueryOptions());
  // The gate's onboarding tier guarantees a Profile snapshot exists (profiles[0] is the latest).
  const latest = meQuery.data?.profiles[0];

  const onRefresh = () => {
    void meQuery.refetch();
    void queryClient.invalidateQueries({ queryKey: ['weights'] });
    void queryClient.invalidateQueries({ queryKey: ['calorie-history'] });
  };

  return (
    // className does not reach SafeAreaView — react-native-css only wraps SafeAreaProvider
    <SafeAreaView style={{ flex: 1, backgroundColor: Palette.white }}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="mx-auto w-full max-w-md sm:max-w-2xl gap-4 px-5 pb-28 pt-4"
        refreshControl={
          <RefreshControl refreshing={meQuery.isRefetching} onRefresh={onRefresh} />
        }>
        <View>
          <DisplayText className="text-2xl text-ink">Progress</DisplayText>
          <Text className="text-sm text-ink-soft">Your intake and progress over time</Text>
        </View>

        {!latest ? (
          <View className="items-center py-10">
            <ActivityIndicator />
          </View>
        ) : (
          <>
            <WeightCard profile={latest} period={wp} onPeriodChange={setWp} />
            <CaloriesCard period={cp} onPeriodChange={setCp} />
            <BmiCard profile={latest} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
