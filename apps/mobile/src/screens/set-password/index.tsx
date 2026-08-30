import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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
 * Native Password-link redemption screen (PRD §10 #19, ADR 0016 + ADR 0021).
 *
 * ROUTING — this screen works for TWO entry paths that share the same expo-router file
 * `app/set-password/[token].tsx`:
 *
 *  1. Custom scheme (works today):
 *       sufra://set-password/<token>?origin=https%3A%2F%2Ffamily.example.com
 *     Expo Router surfaces `token` from the path segment and `origin` from the query string.
 *
 *  2. Universal Link (once AASA lands — ADR 0021, stage 2):
 *       https://<origin>/set-password/<token>?origin=https%3A%2F%2F<origin>
 *     The Worker serves the AASA so iOS/Android intercepts the URL and opens the app.
 *     The `origin` query param is redundant with the URL host but keeps both paths uniform and
 *     removes any need to inspect the raw inbound URL. `sharePasswordLinkMessage` appends it.
 *
 * GATE TIERS — the link is clicked by a NEW Member who has no stored server origin, so this
 * screen must be reachable from the ConnectGate tier. It is declared in ConnectGate's Stack so
 * it works from the very first launch. It is also declared in SessionGate's Stack so a signed-in
 * Host can redeem a test link without being locked out (rare, but harmless to support).
 *
 * FLOW:
 *  • Token validation (GET /password-links/:token) → show who the link is for (username / familyName)
 *    or a friendly expired/invalid state.
 *  • Set-password form (password + confirm, 6+ chars).
 *  • POST /password-links/:token/password — consumes the token, server signs the Member in via Set-Cookie.
 *  • Persist the origin (setServerUrl) → sign in with username + new password → gate flips naturally.
 *  • On sign-in failure (unusual): fall back to /sign-in (origin is now stored, so the gate shows it).
 */
export default function SetPasswordScreen() {
  const router = useRouter();

  // `token` comes from the [token] path segment; `origin` from the query string (both entry paths).
  const { token, origin } = useLocalSearchParams<{ token: string; origin?: string }>();

  // ── Token lookup ────────────────────────────────────────────────────────────────────────
  // Start as 'invalid' when the required params are missing; otherwise 'loading' so the effect
  // can fetch. Initialising from params avoids a synchronous setState-inside-effect.
  const [lookupState, setLookupState] = useState<
    | { kind: 'loading' }
    | { kind: 'invalid' }
    | { kind: 'ready'; username: string; familyName: string }
  >(() => (token && origin ? { kind: 'loading' } : { kind: 'invalid' }));

  useEffect(() => {
    if (!token || !origin) return; // already 'invalid' from initial state
    let cancelled = false;
    void (async () => {
      try {
        const client = await getPublicClient(origin);
        const view = await run(client.passwordLinks.show({ params: { token } }));
        if (!cancelled) setLookupState({ kind: 'ready', username: view.username, familyName: view.familyName });
      } catch {
        if (!cancelled) setLookupState({ kind: 'invalid' });
      }
    })();
    return () => { cancelled = true; };
  }, [token, origin]);

  // ── Password form ───────────────────────────────────────────────────────────────────────
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function validate(): string | null {
    if (password.length < 6) return t`Password must be at least 6 characters.`;
    if (password !== confirm) return t`Passwords don't match.`;
    return null;
  }

  async function onSubmit() {
    const err = validate();
    if (err) { setSubmitError(err); return; }
    if (!token || !origin) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const client = await getPublicClient(origin);
      await run(client.passwordLinks.create({ params: { token }, payload: { password } }));
      // Token consumed; origin is now known — persist it so the auth client can be built.
      setServerUrl(origin);
      // Auto sign-in: the Member just set their own password, so we know both credentials.
      const username = lookupState.kind === 'ready' ? lookupState.username : '';
      const result = await getAuthClient().signIn.username({ username, password });
      if (result.error) {
        // Redemption succeeded but sign-in failed (server hiccup). The origin IS stored, so
        // the gate will show the sign-in screen where the Member can try again.
        router.replace('/sign-in');
      }
      // On success, useSession() in SessionGate flips the gate — no explicit navigate needed.
    } catch {
      setSubmitError(t`Something went wrong. Please try again.`);
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = password.length >= 6 && confirm.length >= 6 && !submitting;

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

              {lookupState.kind === 'loading' ? (
                <LoadingState />
              ) : lookupState.kind === 'invalid' ? (
                <InvalidState
                  onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
                />
              ) : (
                <PasswordForm
                  username={lookupState.username}
                  familyName={lookupState.familyName}
                  password={password}
                  setPassword={setPassword}
                  confirm={confirm}
                  setConfirm={setConfirm}
                  submitError={submitError}
                  submitting={submitting}
                  canSubmit={canSubmit}
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

// ─── Helpers ─────────────────────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <View className="items-center gap-4 py-12">
      <ActivityIndicator color={Palette.flame} />
      <Text className="text-sm text-ink-soft">
        <Trans>Checking your link…</Trans>
      </Text>
    </View>
  );
}

function InvalidState({ onBack }: { onBack: () => void }) {
  return (
    <View className="gap-6">
      <View className="gap-3">
        <DisplayText className="text-2xl text-ink">
          <Trans>Link expired or invalid</Trans>
        </DisplayText>
        <Text className="text-sm text-ink-soft">
          <Trans>
            This link has already been used, expired (links are valid for 24 hours), or isn&apos;t
            valid. Ask your Host for a new link.
          </Trans>
        </Text>
      </View>
      <Pressable
        onPress={onBack}
        className="h-10 items-center justify-center">
        <Text className="text-sm text-ink-soft">
          <Trans>← Back</Trans>
        </Text>
      </Pressable>
    </View>
  );
}

function PasswordForm({
  username,
  familyName,
  password,
  setPassword,
  confirm,
  setConfirm,
  submitError,
  submitting,
  canSubmit,
  onSubmit,
}: {
  username: string;
  familyName: string;
  password: string;
  setPassword: (s: string) => void;
  confirm: string;
  setConfirm: (s: string) => void;
  submitError: string | null;
  submitting: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
}) {
  return (
    <View className="gap-6">
      <View className="gap-3">
        <DisplayText className="text-2xl text-ink">
          <Trans>Welcome to the {familyName} Sufra</Trans>
        </DisplayText>
        <Text className="text-sm text-ink-soft">
          <Trans>
            Hi {username}! Choose a password to set up your account.
          </Trans>
        </Text>
      </View>

      <View className="gap-3">
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
              <Trans>Set password →</Trans>
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
