/**
 * Admin screen — Host-only management: inference cost, vision-model select, Members.
 * Pushed over the tabs from a Profile row.
 * Port of apps/web/src/routes/admin/index.tsx.
 */

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DisplayText } from '@/components/display-text';
import { queryClient } from '@/client/query-client';
import { Palette } from '@/constants/theme';

import { AddMemberForm } from './components/add-member-form';
import { CostCard } from './components/cost-card';
import { MembersList } from './components/members-list';
import { ModelSelect } from './components/model-select';
import {
  inferenceCostQueryOptions,
  membersQueryOptions,
  monthRangeUtc,
  settingsQueryOptions,
} from './queries';

export default function AdminScreen() {
  const router = useRouter();
  const range = monthRangeUtc();

  const costQuery = useQuery(inferenceCostQueryOptions(range));
  // settings and members are also fetched here to drive initial load; the child components
  // (ModelSelect, MembersList) run their own useQuery calls against the same keys.
  const settingsQuery = useQuery(settingsQueryOptions());
  const membersQuery = useQuery(membersQueryOptions());

  const isLoading =
    costQuery.isLoading || settingsQuery.isLoading || membersQuery.isLoading;
  const isRefetching =
    costQuery.isRefetching || settingsQuery.isRefetching || membersQuery.isRefetching;

  function handleRefresh() {
    void queryClient.invalidateQueries({ queryKey: ['admin'] });
  }

  const cost = costQuery.data;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Palette.cream }}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="mx-auto w-full max-w-md sm:max-w-2xl gap-6 px-5 pb-28 pt-4"
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} />
        }
      >
        {/* Header */}
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={() => router.back()}
            className="h-9 w-9 items-center justify-center rounded-[9999px]"
          >
            <Text className="text-2xl text-ink-soft">‹</Text>
          </Pressable>
          <View>
            <DisplayText className="text-2xl text-ink">Admin</DisplayText>
            <Text className="text-sm text-ink-soft">Host only</Text>
          </View>
        </View>

        {/* Body */}
        {isLoading || !cost ? (
          <View className="items-center py-10">
            <ActivityIndicator />
          </View>
        ) : (
          <>
            <CostCard
              totalUsd={cost.totalUsd}
              perMemberAvgUsd={cost.perMemberAvgUsd}
              runCount={cost.runCount}
            />

            {/* Vision Model section */}
            <View>
              <Text className="mb-2 text-xs font-medium uppercase text-ink-soft">
                Vision Model
              </Text>
              <ModelSelect />
            </View>

            {/* Members section */}
            <View>
              <Text className="mb-2 text-xs font-medium uppercase text-ink-soft">
                Members
              </Text>
              <AddMemberForm />
              <View className="mt-2">
                <MembersList />
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
