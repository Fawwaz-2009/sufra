import { Button, Column, Host, Text, TextInput } from '@expo/ui';
import { controlSize } from '@expo/ui/swift-ui/modifiers';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { authClient } from '@/client/auth-client';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Sign in with username + password (the only credential — Sufra has no email; accounts are provisioned
 * by the Host). On success Better Auth stores the session and the root gate's `useSession()` swaps to
 * the (app) shell, so there's no manual navigation here. A failed attempt surfaces inline.
 *
 * Built on @expo/ui universal components (native TextField/Button under the hood, hence the `Host`).
 * The fields are `useNativeState` observables — the universal State model, read via `.value`. First
 * tier only: Setup (the first Host) and onboarding land later (M4 / M3); the Worker is the real gate.
 */
export default function SignInScreen() {
  const theme = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const fieldWidth = Math.min(screenWidth - Spacing.four * 2, MaxContentWidth);
  // React state, not @expo/ui's useNativeState: on iOS the latter is a SwiftUI @State bridge whose
  // `.value` writes drive the native field but do NOT re-render React, so derived UI (canSubmit) would
  // never recompute. The fields are uncontrolled (native owns the text); onChangeText mirrors here.
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = username.trim().length > 0 && password.length > 0 && !submitting;

  async function onSubmit() {
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    const result = await authClient.signIn.username({
      username: username.trim(),
      password,
    });
    setSubmitting(false);
    if (result.error) {
      setError(result.error.message ?? 'Could not sign in. Check your username and password.');
    }
  }

  // The native iOS "filled field" shape: fill + generous radius + padding-based height, no border.
  // backgroundColor/borderRadius/padding are UNIVERSAL style → SwiftUI background/clipShape/padding on
  // iOS, Compose on Android. CAVEAT (cost us a crash): universal-style dimensions must be NUMERIC —
  // Android's Compose casts the `width`/`height` field to Int and throws on a percentage string like
  // '100%' (iOS/SwiftUI tolerates it), so the width is computed from the window, not '100%'.
  const inputStyle = {
    width: fieldWidth,
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
    backgroundColor: theme.backgroundElement,
  } as const;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <View style={styles.center}>
        <Host matchContents style={styles.host}>
          <Column spacing={Spacing.four} alignment="center">
            <Column spacing={Spacing.one} alignment="center">
              <Text textStyle={{ fontSize: 34, fontWeight: '700', color: theme.text }}>Sufra</Text>
              <Text textStyle={{ fontSize: 16, color: theme.textSecondary }}>
                Sign in to continue
              </Text>
            </Column>

            <Column spacing={Spacing.three} alignment="center">
              <TextInput
                onChangeText={setUsername}
                placeholder="Username"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                returnKeyType="next"
                editable={!submitting}
                style={inputStyle}
                textStyle={{ fontSize: 17, color: theme.text }}
              />
              <TextInput
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor={theme.textSecondary}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="current-password"
                returnKeyType="go"
                onSubmitEditing={onSubmit}
                editable={!submitting}
                style={inputStyle}
                textStyle={{ fontSize: 17, color: theme.text }}
              />

              {error ? <Text textStyle={{ fontSize: 14, color: '#E5484D' }}>{error}</Text> : null}

              <Button
                variant="filled"
                modifiers={[controlSize('large')]}
                disabled={!canSubmit}
                onPress={onSubmit}
                label={submitting ? 'Signing in…' : 'Sign in'}
              />
            </Column>
          </Column>
        </Host>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.four },
  host: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
});
