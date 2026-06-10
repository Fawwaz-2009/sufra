import '@/global.css';

import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { AppState, Platform, useColorScheme, type AppStateStatus } from 'react-native';
import { focusManager, QueryClientProvider } from '@tanstack/react-query';

import { authClient } from '@/client/auth-client';
import { queryClient } from '@/client/query-client';

// Hold the native splash until the cached session resolves, so a signed-in user never sees the
// sign-in screen flash. SecureStore.getItem is synchronous, so this is a brief tick.
SplashScreen.preventAutoHideAsync();

/**
 * The root auth gate. `Stack.Protected` renders the (app) shell when there's a session and the
 * sign-in screen otherwise — client-side UX only; the Worker's `Authentication` middleware stays the
 * real gate on every `/api/*` call. Sign-out flips `useSession()` back to no-session and the gate
 * swaps to sign-in. Further tiers (onboarding, host-only admin) nest here later (M3/M4) as additional
 * guards reading the same session.
 */
// RN has no window focus events — bridge AppState so return-from-background counts as focus
// (with staleTime 30s, reopening the app refetches a stale Day summary automatically).
function onAppStateChange(status: AppStateStatus) {
  if (Platform.OS !== 'web') {
    focusManager.setFocused(status === 'active');
  }
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (!isPending) SplashScreen.hideAsync();
  }, [isPending]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', onAppStateChange);
    return () => subscription.remove();
  }, []);

  if (isPending) return null;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={!!session}>
            <Stack.Screen name="(app)" />
          </Stack.Protected>
          <Stack.Protected guard={!session}>
            <Stack.Screen name="sign-in" />
          </Stack.Protected>
        </Stack>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
