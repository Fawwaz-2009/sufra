import { FieldGroup, Host, Row, Spacer, Text as NativeText } from '@expo/ui';
import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getAuthClient } from '@/client/auth-client';
import { meQueryOptions } from '@/client/me';
import { queryClient } from '@/client/query-client';
import { getServerUrl, setServerUrl } from '@/client/server';
import { formatLocalDate, todayLocal } from '@/lib/date';
import { formatHeight, formatWeight } from '@/lib/units';
import type { ActivityLevel, Sex } from '@sufra-web/worker/models/profile-snapshot.ts';
import { ageFromBirthday, deriveProfile } from '@sufra-web/worker/views/derive.ts';

import { GoalSheet } from './components/goal-sheet';
import { HeightSheet } from './components/height-sheet';
import { OptionSheet } from './components/option-sheet';
import { ACTIVITY_DESCRIPTIONS, ACTIVITY_LABELS, useProfilePatch, type ProfileEdit } from './helpers';

const SEX_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
] as const satisfies readonly { value: Sex; label: string }[];

const ACTIVITY_OPTIONS = (Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((level) => ({
  value: level,
  label: ACTIVITY_LABELS[level],
  description: ACTIVITY_DESCRIPTIONS[level],
}));

const SECONDARY = { color: '#71717A', fontSize: 14 } as const;
const LABEL = { fontSize: 16 } as const;

/**
 * Settings — the @expo/ui surface (the native-feel spike): a `FieldGroup` of grouped rows rendered
 * by SwiftUI Form / Material 3 inside one `Host`. Single-tap fields commit INLINE (a menu Picker for
 * Sex/Activity, the platform date dialog for Birthday) — safe because same-day edits upsert onto the
 * same effective-tomorrow snapshot (ADR 0002); multi-input fields (Height, Goal) keep the batched
 * Save sheet. The sheets and the date dialog are RN-tree siblings — an RN Modal can't live inside
 * the native subtree.
 */
export default function SettingsScreen() {
  const meQuery = useQuery(meQueryOptions());
  const me = meQuery.data;
  // The gate's onboarding tier guarantees a snapshot by the time this tab renders (profiles[0] is
  // the latest).
  const latest = me?.profiles[0];
  const derived = useMemo(() => (latest ? deriveProfile(latest) : null), [latest]);
  const todayStr = formatLocalDate(todayLocal());
  const patch = useProfilePatch();
  const [openSheet, setOpenSheet] = useState<'sex' | 'activity' | 'height' | 'goal' | null>(null);
  const [birthdayPickerOpen, setBirthdayPickerOpen] = useState(false);

  // Inline commit for single-tap fields — errors surface as a native alert (there is no sheet to
  // hold an inline message).
  const commit = (edit: ProfileEdit) =>
    patch.mutate(edit, {
      onError: () => Alert.alert("Couldn't save", 'Try again in a moment.'),
    });

  const signOut = async () => {
    await getAuthClient().signOut();
    queryClient.clear();
  };

  // Changing servers signs out first (the SecureStore cookie jar is shared across origins — a stale
  // cookie must not replay against the next backend), clears the query cache, then drops the origin;
  // the root gate flips back to Connect (ADR 0018).
  const changeServer = () => {
    Alert.alert(
      'Change server?',
      "You'll be signed out, and this device will forget the current server.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Change server',
          style: 'destructive',
          onPress: () => {
            void getAuthClient()
              .signOut()
              .catch(() => {
                // Best-effort: an unreachable server must not block leaving it.
              })
              .finally(() => {
                queryClient.clear();
                setServerUrl(null);
              });
          },
        },
      ]
    );
  };

  const goalDirection = latest
    ? latest.goalWeightKg < latest.weightKg
      ? 'Lose'
      : latest.goalWeightKg > latest.weightKg
        ? 'Gain'
        : 'Maintain'
    : 'Maintain';
  const goalSub =
    latest && goalDirection !== 'Maintain'
      ? `${goalDirection} to ${latest.goalWeightKg} kg · ~${latest.weeklyRateKg} kg/wk`
      : 'Holding current weight';

  return (
    // className does not reach SafeAreaView — react-native-css only wraps SafeAreaProvider
    <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <View className="flex-row items-start justify-between gap-3 px-5 pt-4 pb-2">
        <View>
          <Text className="text-2xl font-semibold text-black">Settings</Text>
          <Text className="text-sm text-zinc-500">Your account and plan</Text>
        </View>
        <Pressable
          onPress={signOut}
          accessibilityLabel="Sign out"
          className="h-9 items-center justify-center rounded-[9999px] px-3">
          <Text className="text-sm font-medium text-zinc-500">Sign out</Text>
        </Pressable>
      </View>

      {!latest || !derived ? (
        <View className="items-center py-10">
          <ActivityIndicator />
        </View>
      ) : (
        <>
          <Host style={{ flex: 1 }} useViewportSizeMeasurement colorScheme="light">
            <FieldGroup style={{ backgroundColor: '#ffffff' }}>
              <FieldGroup.Section title="About you">
                <Row alignment="center" onPress={() => setOpenSheet('sex')}>
                  <NativeText textStyle={LABEL}>Sex</NativeText>
                  <Spacer flexible />
                  <NativeText textStyle={SECONDARY}>
                    {latest.sex === 'male' ? 'Male' : 'Female'}
                  </NativeText>
                </Row>
                <Row alignment="center" onPress={() => setBirthdayPickerOpen(true)}>
                  <NativeText textStyle={LABEL}>Birthday</NativeText>
                  <Spacer flexible />
                  <NativeText textStyle={SECONDARY}>
                    {`${latest.birthday} · ${ageFromBirthday(latest.birthday)} yr`}
                  </NativeText>
                </Row>
                <Row alignment="center" onPress={() => setOpenSheet('height')}>
                  <NativeText textStyle={LABEL}>Height</NativeText>
                  <Spacer flexible />
                  <NativeText textStyle={SECONDARY}>
                    {formatHeight(latest.heightCm, latest.displayHeightUnit)}
                  </NativeText>
                </Row>
                <Row alignment="center">
                  <NativeText textStyle={LABEL}>Weight</NativeText>
                  <Spacer flexible />
                  <NativeText textStyle={SECONDARY}>
                    {formatWeight(latest.weightKg, latest.displayWeightUnit)}
                  </NativeText>
                </Row>
                <Row alignment="center" onPress={() => setOpenSheet('activity')}>
                  <NativeText textStyle={LABEL}>Activity</NativeText>
                  <Spacer flexible />
                  <NativeText textStyle={SECONDARY}>
                    {ACTIVITY_LABELS[latest.activityLevel]}
                  </NativeText>
                </Row>
                <FieldGroup.SectionFooter>
                  <NativeText textStyle={{ color: '#71717A', fontSize: 12 }}>
                    Changes start tomorrow at midnight (your local time).
                  </NativeText>
                </FieldGroup.SectionFooter>
              </FieldGroup.Section>

              <FieldGroup.Section title="Goal">
                <Row alignment="center" onPress={() => setOpenSheet('goal')}>
                  <NativeText textStyle={LABEL}>{goalDirection}</NativeText>
                  <Spacer flexible />
                  <NativeText textStyle={SECONDARY}>{goalSub}</NativeText>
                </Row>
              </FieldGroup.Section>

              <FieldGroup.Section title="Your numbers">
                <Row alignment="center">
                  <NativeText textStyle={LABEL}>Daily target</NativeText>
                  <Spacer flexible />
                  <NativeText textStyle={{ fontSize: 18, fontWeight: '600' }}>
                    {`${derived.targetKcal} kcal`}
                  </NativeText>
                </Row>
                <Row alignment="center">
                  <NativeText textStyle={LABEL}>Macros</NativeText>
                  <Spacer flexible />
                  <NativeText textStyle={SECONDARY}>
                    {`P ${derived.macros.proteinG}g · C ${derived.macros.carbsG}g · F ${derived.macros.fatG}g`}
                  </NativeText>
                </Row>
                {/* No conditional hole here: a `null` child renders as an EMPTY ROW (the section's
                    slot extraction pushes non-element children verbatim) — an ARRAY child instead
                    (empty when not pending; Babel rejects JSX spread children). */}
                {latest.effectiveFrom > todayStr
                  ? [
                      <FieldGroup.SectionFooter key="pending">
                        <NativeText textStyle={{ color: '#71717A', fontSize: 12 }}>
                          Pending changes — starts tomorrow.
                        </NativeText>
                      </FieldGroup.SectionFooter>,
                    ]
                  : []}
              </FieldGroup.Section>

              <FieldGroup.Section title="Account">
                <Row alignment="center">
                  <NativeText textStyle={LABEL}>Username</NativeText>
                  <Spacer flexible />
                  <NativeText textStyle={SECONDARY}>{me?.username ?? ''}</NativeText>
                </Row>
                <Row alignment="center" onPress={changeServer}>
                  <NativeText textStyle={LABEL}>Server</NativeText>
                  <Spacer flexible />
                  <NativeText textStyle={SECONDARY} numberOfLines={1}>
                    {getServerUrl() ?? ''}
                  </NativeText>
                </Row>
              </FieldGroup.Section>
            </FieldGroup>
          </Host>

          {/* RN-tree siblings: the platform date dialog + the batched-Save sheets. */}
          {birthdayPickerOpen ? (
            <DateTimePicker
              // The Material dialog is UTC-anchored: build the value at UTC midnight and read the
              // selection back through UTC getters, or the highlighted/returned day drifts by one
              // depending on the device's offset sign. (Verified on Android; re-check on iOS.)
              value={birthdayAsUtcDate(latest.birthday)}
              mode="date"
              minimumDate={birthdayUtcBound(-110)}
              maximumDate={birthdayUtcBound(0)}
              onValueChange={(_event, date) => {
                setBirthdayPickerOpen(false);
                const next = formatUtcDate(date);
                if (next !== latest.birthday) commit({ birthday: next });
              }}
              onDismiss={() => setBirthdayPickerOpen(false)}
            />
          ) : null}
          <HeightSheet
            visible={openSheet === 'height'}
            onClose={() => setOpenSheet(null)}
            profile={latest}
          />
          <GoalSheet
            visible={openSheet === 'goal'}
            onClose={() => setOpenSheet(null)}
            profile={latest}
          />
          <OptionSheet
            visible={openSheet === 'sex'}
            title="Which formula should we use?"
            options={SEX_OPTIONS}
            selected={latest.sex}
            onSelect={(v) => {
              setOpenSheet(null);
              if (v !== latest.sex) commit({ sex: v });
            }}
            onClose={() => setOpenSheet(null)}
          />
          <OptionSheet
            visible={openSheet === 'activity'}
            title="Activity level"
            options={ACTIVITY_OPTIONS}
            selected={latest.activityLevel}
            onSelect={(v) => {
              setOpenSheet(null);
              if (v !== latest.activityLevel) commit({ activityLevel: v });
            }}
            onClose={() => setOpenSheet(null)}
          />
        </>
      )}
    </SafeAreaView>
  );
}

function birthdayAsUtcDate(birthday: string): Date {
  const [y = 1990, m = 1, d = 1] = birthday.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function birthdayUtcBound(yearOffset: number): Date {
  const t = todayLocal();
  return new Date(Date.UTC(t.getFullYear() + yearOffset, t.getMonth(), t.getDate()));
}

function formatUtcDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
