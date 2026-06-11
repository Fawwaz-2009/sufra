import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getAuthClient } from '@/client/auth-client';
import { meQueryOptions } from '@/client/me';
import { queryClient } from '@/client/query-client';
import { DisplayText } from '@/components/display-text';
import { Palette } from '@/constants/theme';
import { formatLocalDate, todayLocal } from '@/lib/date';
import { deriveProfile } from '@sufra-web/worker/views/derive.ts';

import { AboutYouSection } from './components/about-you-section';
import { AccountSection } from './components/account-section';
import { GoalSection } from './components/goal-section';
import { SavedMealsSection } from './components/saved-meals-section';
import { YourNumbersSection } from './components/your-numbers-section';

/**
 * Profile — the native counterpart of the web Profile page: the latest snapshot's values in
 * sections, per-field edit sheets appending a snapshot effective tomorrow (ADR 0002), the derived
 * numbers, the account actions (sign out; change server, ADR 0018), and Saved Meals (shared
 * MealCards, tap => the detail; last like web). Sign-out lives in the header's top-right, like web
 * (body-anchored buttons get pushed off-screen as sections grow).
 */
export default function ProfileScreen() {
  const meQuery = useQuery(meQueryOptions());
  const me = meQuery.data;
  // The gate's onboarding tier guarantees a snapshot by the time this tab renders (profiles[0] is
  // the latest).
  const latest = me?.profiles[0];
  const derived = useMemo(() => (latest ? deriveProfile(latest) : null), [latest]);
  const todayStr = formatLocalDate(todayLocal());

  const signOut = async () => {
    await getAuthClient().signOut();
    queryClient.clear();
  };

  return (
    // className does not reach SafeAreaView — react-native-css only wraps SafeAreaProvider
    <SafeAreaView style={{ flex: 1, backgroundColor: Palette.cream }}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="mx-auto w-full max-w-md sm:max-w-2xl gap-6 px-5 pb-28 pt-4"
        refreshControl={
          <RefreshControl refreshing={meQuery.isRefetching} onRefresh={() => meQuery.refetch()} />
        }>
        <View className="flex-row items-start justify-between gap-3">
          <View>
            <DisplayText className="text-2xl text-ink">Profile</DisplayText>
            <Text className="text-sm text-ink-soft">Your account and plan</Text>
          </View>
          <Pressable
            onPress={signOut}
            accessibilityLabel="Sign out"
            className="h-9 items-center justify-center rounded-[9999px] px-3">
            <Text className="text-sm font-medium text-ink-soft">Sign out</Text>
          </Pressable>
        </View>

        {!latest || !derived ? (
          <View className="items-center py-10">
            <ActivityIndicator />
          </View>
        ) : (
          <>
            <AboutYouSection profile={latest} />
            <GoalSection profile={latest} />
            <YourNumbersSection
              targetKcal={derived.targetKcal}
              macros={derived.macros}
              hasPending={latest.effectiveFrom > todayStr}
            />
            <AccountSection username={me?.username ?? ''} isHost={me?.role === 'host'} />
            <SavedMealsSection />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
