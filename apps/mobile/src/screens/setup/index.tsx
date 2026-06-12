import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Pressable } from '@/components/pressable';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getAuthClient } from '@/client/auth-client';
import { getPublicClient, run } from '@/client/api-client';
import { setServerUrl } from '@/client/server';
import { DisplayText } from '@/components/display-text';
import { Palette } from '@/constants/theme';

/**
 * Native Setup wizard — reached from the Connect screen when the probe reports `needsSetup`
 * (a fresh deploy with no Host yet). Mirrors the web wizard's two-step flow: family name →
 * Host account. On success, persists the origin and signs in immediately with the just-entered
 * credentials, so the gate advances naturally to Onboarding (no profile snapshot yet).
 *
 * The origin is passed as a URL param (`origin`) because we're still at the Connect tier —
 * the server URL hasn't been stored yet, and we must POST against the candidate origin.
 */
export default function SetupScreen() {
  const router = useRouter();
  const { origin } = useLocalSearchParams<{ origin: string }>();
  const [step, setStep] = useState<1 | 2>(1);

  const [familyName, setFamilyName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const trimmedFamily = familyName.trim();
  const canContinueStep1 = trimmedFamily.length > 0 && trimmedFamily.length <= 40;

  function validateStep2(): string | null {
    if (username.length < 3) return t`Username must be at least 3 characters.`;
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return t`Username: letters, numbers, underscore only.`;
    if (password.length < 6) return t`Password must be at least 6 characters.`;
    if (password !== confirm) return t`Passwords don't match.`;
    return null;
  }

  async function onSubmit() {
    const err = validateStep2();
    if (err) {
      setSubmitError(err);
      return;
    }
    if (!origin) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      // Creates the first Host + seeds app_settings; the server issues the session cookie.
      await run(
        (await getPublicClient(origin)).setup.create({
          payload: { familyName: trimmedFamily, username, password },
        })
      );
      // Persist the origin so the typed client and auth client pick it up (ADR 0018).
      setServerUrl(origin);
      // Sign in immediately with the just-entered credentials — no need to make the user retype.
      // The session cookie will be captured into SecureStore by the expoClient plugin, and
      // useSession() will flip the gate to Onboarding (the new Host has no profile snapshot yet).
      const result = await getAuthClient().signIn.username({ username, password });
      if (result.error) {
        // Setup succeeded but auto sign-in failed — this is unusual. Fall back gracefully.
        // The gate is now past Connect (serverUrl is set) so sign-in screen will appear.
        router.replace('/sign-in');
      }
      // On success, useSession() flips in SessionGate; no explicit navigate needed.
    } catch (e) {
      setSubmitError(
        e instanceof Error && e.message ? e.message : t`Setup failed. Please try again.`
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    // className does not reach SafeAreaView — react-native-css only wraps SafeAreaProvider
    <SafeAreaView style={{ flex: 1, backgroundColor: Palette.white }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1">
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled">
          <View className="flex-1 justify-center px-6 py-10">
            <View className="mx-auto w-full max-w-md gap-8">
              <View className="items-center gap-1">
                <Image
                  source={require('@/assets/images/sufra-circle.png')}
                  style={{ width: 72, height: 72 }}
                />
                <DisplayText className="text-4xl text-ink">Sufra</DisplayText>
              </View>

              <StepDots step={step} />

              {step === 1 ? (
                <StepFamilyName
                  familyName={familyName}
                  setFamilyName={setFamilyName}
                  canContinue={canContinueStep1}
                  onContinue={() => setStep(2)}
                  onBack={() => router.back()}
                />
              ) : (
                <StepAccount
                  familyName={trimmedFamily}
                  username={username}
                  setUsername={setUsername}
                  password={password}
                  setPassword={setPassword}
                  confirm={confirm}
                  setConfirm={setConfirm}
                  submitError={submitError}
                  submitting={submitting}
                  onBack={() => {
                    setSubmitError(null);
                    setStep(1);
                  }}
                  onSubmit={onSubmit}
                />
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function StepDots({ step }: { step: 1 | 2 }) {
  return (
    <View className="flex-row items-center justify-center gap-2">
      <View className={`h-2 w-2 rounded-[9999px] ${step >= 1 ? 'bg-flame' : 'bg-track'}`} />
      <View className={`h-2 w-2 rounded-[9999px] ${step >= 2 ? 'bg-flame' : 'bg-track'}`} />
    </View>
  );
}

function StepFamilyName({
  familyName,
  setFamilyName,
  canContinue,
  onContinue,
  onBack,
}: {
  familyName: string;
  setFamilyName: (s: string) => void;
  canContinue: boolean;
  onContinue: () => void;
  onBack: () => void;
}) {
  const trimmed = familyName.trim();
  const previewName = trimmed.length > 0 ? trimmed : '…';

  return (
    <View className="gap-6">
      <View className="gap-3">
        <DisplayText className="text-2xl text-ink">
          <Trans>Welcome to Sufra</Trans>
        </DisplayText>
        <Text className="text-sm text-ink-soft">
          <Trans>
            Sufra is the Arabic word for the dining table — more than the furniture, it&apos;s the
            spread of food and the people gathered around it. Sufra exists to help you stay at yours.
          </Trans>
        </Text>
      </View>

      <View className="gap-3">
        <Text className="text-sm text-ink-soft">
          <Trans>What do you call your sufra?</Trans>
        </Text>
        <TextInput
          className="rounded-2xl bg-surface px-4 py-4 text-[17px]"
          style={{ color: Palette.ink }}
          value={familyName}
          onChangeText={setFamilyName}
          placeholder={t`Your family name`}
          placeholderTextColor={Palette.inkFaint}
          autoCapitalize="words"
          autoCorrect={false}
          maxLength={40}
          returnKeyType="next"
          onSubmitEditing={() => { if (canContinue) onContinue(); }}
          editable={true}
        />
        <Text className="text-xs text-ink-soft">
          <Trans>Your Sufra will be called the {previewName} Sufra</Trans>
        </Text>

        <Pressable
          disabled={!canContinue}
          onPress={onContinue}
          className="mt-2 h-12 items-center justify-center rounded-[9999px] bg-flame">
          <Text className="text-base font-semibold text-white">
            <Trans>Continue →</Trans>
          </Text>
        </Pressable>

        <Pressable
          onPress={onBack}
          className="h-10 items-center justify-center">
          <Text className="text-sm text-ink-soft">
            <Trans>← Back to Connect</Trans>
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function StepAccount({
  familyName,
  username,
  setUsername,
  password,
  setPassword,
  confirm,
  setConfirm,
  submitError,
  submitting,
  onBack,
  onSubmit,
}: {
  familyName: string;
  username: string;
  setUsername: (s: string) => void;
  password: string;
  setPassword: (s: string) => void;
  confirm: string;
  setConfirm: (s: string) => void;
  submitError: string | null;
  submitting: boolean;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const canSubmit =
    username.trim().length >= 3 &&
    password.length >= 6 &&
    confirm.length >= 6 &&
    !submitting;

  return (
    <View className="gap-6">
      <View className="gap-3">
        <DisplayText className="text-2xl text-ink">
          <Trans>Create your account</Trans>
        </DisplayText>
        <Text className="text-sm text-ink-soft">
          <Trans>
            You&apos;re the Host. You manage the {familyName} Sufra and invite the people who&apos;ll
            join you at it.
          </Trans>
        </Text>
      </View>

      <View className="gap-3">
        <TextInput
          className="rounded-2xl bg-surface px-4 py-4 text-[17px]"
          style={{ color: Palette.ink }}
          value={username}
          onChangeText={setUsername}
          placeholder={t`Username`}
          placeholderTextColor={Palette.inkFaint}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          returnKeyType="next"
          editable={!submitting}
        />
        <TextInput
          className="rounded-2xl bg-surface px-4 py-4 text-[17px]"
          style={{ color: Palette.ink }}
          value={password}
          onChangeText={setPassword}
          placeholder={t`Password (6+ characters)`}
          placeholderTextColor={Palette.inkFaint}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          returnKeyType="next"
          editable={!submitting}
        />
        <TextInput
          className="rounded-2xl bg-surface px-4 py-4 text-[17px]"
          style={{ color: Palette.ink }}
          value={confirm}
          onChangeText={setConfirm}
          placeholder={t`Confirm password`}
          placeholderTextColor={Palette.inkFaint}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          returnKeyType="go"
          onSubmitEditing={onSubmit}
          editable={!submitting}
        />

        {submitError ? <Text className="text-sm text-red">{submitError}</Text> : null}

        <Pressable
          disabled={!canSubmit}
          onPress={onSubmit}
          className="mt-2 h-12 items-center justify-center rounded-[9999px] bg-flame">
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-base font-semibold text-white">
              <Trans>Create the {familyName} Sufra →</Trans>
            </Text>
          )}
        </Pressable>

        <Pressable
          disabled={submitting}
          onPress={onBack}
          className="h-10 items-center justify-center">
          <Text className="text-sm text-ink-soft">
            <Trans>← Back</Trans>
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
