import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Palette } from '@/constants/theme';

import { getClient, run } from '@/client/api-client';
import { meKey } from '@/client/me';
import { formatLocalDate, todayLocal } from '@/lib/date';

import { StepActivity } from './components/step-activity';
import { StepBirthday } from './components/step-birthday';
import { StepGoal } from './components/step-goal';
import { StepHeight } from './components/step-height';
import { StepSex } from './components/step-sex';
import { StepWeight } from './components/step-weight';
import { BackButton, Dots } from './components/wizard-shell';
import { INITIAL_DRAFT, isStepValid, type Draft, type Step } from './types';

/**
 * Onboarding — the web wizard translated to RN primitives (ceremonial first-time UX, the
 * counter-exception to the minimal-UI default). Reached only through the root gate's onboarding tier
 * (signed in, no Profile snapshot yet), so there is no bounce check here — the gate swaps to the
 * (app) shell the moment `/me` reports `isOnboarded`.
 */
export default function OnboardingScreen() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>(1);
  const [draft, setDraft] = useState<Draft>(INITIAL_DRAFT);

  const update = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const goNext = () => setStep((s) => (s < 6 ? ((s + 1) as Step) : s));
  const goBack = () => setStep((s) => (s > 1 ? ((s - 1) as Step) : s));

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (
        !draft.sex ||
        !draft.birthday ||
        draft.heightCm == null ||
        draft.weightKg == null ||
        !draft.activityLevel ||
        draft.goalWeightKg == null
      ) {
        throw new Error(t`Some fields are still empty.`);
      }
      // The first POST /profile-snapshots IS onboarding (ADR 0011): applies same-day (effectiveFrom =
      // today) and the server seeds the first Weight measurement.
      return run(
        (await getClient()).profileSnapshots.create({
          payload: {
            sex: draft.sex,
            birthday: draft.birthday,
            heightCm: draft.heightCm,
            displayHeightUnit: draft.displayHeightUnit,
            weightKg: draft.weightKg,
            displayWeightUnit: draft.displayWeightUnit,
            activityLevel: draft.activityLevel,
            goalWeightKg: draft.goalWeightKg,
            weeklyRateKg: draft.weeklyRateKg,
            effectiveFrom: formatLocalDate(todayLocal()),
          },
        })
      );
    },
    // `refetchType: 'all'` + await, like web: force the `/me` refetch and only then let the gate
    // (which observes the same key) read `isOnboarded` and swap this screen for the (app) shell.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: meKey, refetchType: 'all' }),
  });

  const isSubmitting = submitMutation.isPending;
  const onContinue = () => {
    if (!isStepValid(step, draft) || isSubmitting) return;
    if (step === 6) submitMutation.mutate();
    else goNext();
  };

  return (
    // className does not reach SafeAreaView — react-native-css only wraps SafeAreaProvider
    <SafeAreaView style={{ flex: 1, backgroundColor: Palette.white }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1">
        <View className="mx-auto w-full max-w-md flex-1 px-6 py-4">
          <View className="flex-row items-center">
            <BackButton onPress={goBack} disabled={step === 1 || isSubmitting} />
            <Dots count={6} current={step} />
            {/* mirror the back button so the dots sit truly centered */}
            <View className="h-10 w-10" />
          </View>

          <ScrollView
            className="mt-8 flex-1"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {step === 1 && (
              <StepSex
                value={draft.sex}
                onChange={(v) => {
                  update('sex', v);
                  goNext();
                }}
              />
            )}
            {step === 2 && (
              <StepBirthday value={draft.birthday} onChange={(v) => update('birthday', v)} />
            )}
            {step === 3 && (
              <StepHeight
                heightCm={draft.heightCm}
                unit={draft.displayHeightUnit}
                onHeightChange={(cm) => update('heightCm', cm)}
                onUnitChange={(u) => update('displayHeightUnit', u)}
              />
            )}
            {step === 4 && (
              <StepWeight
                weightKg={draft.weightKg}
                unit={draft.displayWeightUnit}
                onWeightChange={(kg) => {
                  update('weightKg', kg);
                  // Keep goal weight in sync with current weight until the
                  // Member explicitly moves the slider in step 6. Without this,
                  // typing "93.5" intermediate-fires onWeightChange(93) which
                  // pinned goalWeightKg=93 while weightKg later became 93.5 —
                  // a stuck-at-intermediate misalignment.
                  update('goalWeightKg', kg);
                }}
                onUnitChange={(u) => update('displayWeightUnit', u)}
              />
            )}
            {step === 5 && (
              <StepActivity
                value={draft.activityLevel}
                onChange={(v) => update('activityLevel', v)}
              />
            )}
            {step === 6 && (
              <StepGoal
                draft={draft}
                onGoalWeightChange={(kg) => update('goalWeightKg', kg)}
                onRateChange={(r) => update('weeklyRateKg', r)}
              />
            )}
          </ScrollView>

          {step !== 1 ? (
            <View className="mt-4 gap-2 pb-2">
              {submitMutation.isError ? (
                <Text className="text-sm text-red">
                  {submitMutation.error instanceof Error
                    ? t`Error: ${submitMutation.error.message}`
                    : t`Something went wrong. Try again.`}
                </Text>
              ) : null}
              <Pressable
                disabled={!isStepValid(step, draft) || isSubmitting}
                onPress={onContinue}
                className={`h-12 items-center justify-center rounded-[9999px] bg-flame ${
                  !isStepValid(step, draft) || isSubmitting ? 'opacity-60' : ''
                }`}>
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text className="text-base font-semibold text-white">
                    {step === 6 ? <Trans>Finish</Trans> : <Trans>Continue</Trans>}
                  </Text>
                )}
              </Pressable>
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
