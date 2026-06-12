// Direction is boot state — the RTL side-effect module runs BEFORE anything lays out (ADR 0020).
import '@/lib/rtl';
import '@/global.css';

import { I18nProvider } from '@lingui/react';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import { focusManager, QueryClientProvider, useQuery } from '@tanstack/react-query';

import { getAuthClient } from '@/client/auth-client';
import { useEntitlement } from '@/client/entitlement';
import { meQueryOptions } from '@/client/me';
import { queryClient } from '@/client/query-client';
import { setServerUrl, useServerUrl } from '@/client/server';
import { GateError, GateLoading } from '@/components/gate-status';
import { Palette } from '@/constants/theme';
import { i18n } from '@/lib/i18n';

// Hold the native splash until the cached session resolves, so a signed-in user never sees the
// sign-in screen flash. SecureStore.getItem is synchronous, so this is a brief tick.
SplashScreen.preventAutoHideAsync();

// RN has no window focus events — bridge AppState so return-from-background counts as focus
// (with staleTime 30s, reopening the app refetches a stale Day summary automatically).
function onAppStateChange(status: AppStateStatus) {
  if (Platform.OS !== 'web') {
    focusManager.setFocused(status === 'active');
  }
}

/**
 * The root gate, tiered top-down (ADR 0018 + frontend-expo.md): no server origin → Connect; no
 * trial or unlock → Paywall (the trial clock starts at first successful Connect, so this tier sits
 * just past it — entitlement is CLIENT state, never the self-hosted server's); no session →
 * sign-in; no Profile snapshot → Onboarding; else the (app) shell. The origin is USER STATE, so
 * the session tier can only mount once it exists — `SessionGate` is a separate component (its
 * `useSession()` needs the origin-keyed auth client) and is remounted via `key` when the origin
 * changes, so a server switch never reuses hooks bound to the old client. Client-side UX only; the
 * Worker's `Authentication` middleware stays the real gate on every `/api/*` call.
 */
// Light is pinned (design.md — Daylight); navigation surfaces ride the white so screen
// transitions never flash a foreign color.
const SufraTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: Palette.flame,
    background: Palette.white,
    card: Palette.white,
    text: Palette.ink,
    border: Palette.line,
  },
} as const;

export default function RootLayout() {
  const serverUrl = useServerUrl();
  const entitlement = useEntitlement();

  useEffect(() => {
    const subscription = AppState.addEventListener('change', onAppStateChange);
    return () => subscription.remove();
  }, []);

  const tier = !serverUrl ? (
    <ConnectGate />
  ) : entitlement.kind === 'unlocked' || entitlement.kind === 'trial' ? (
    <SessionGate key={serverUrl} />
  ) : (
    <PaywallGate loading={entitlement.kind === 'loading'} />
  );

  return (
    <I18nProvider i18n={i18n}>
      <ThemeProvider value={SufraTheme}>
        <StatusBar style="dark" />
        <QueryClientProvider client={queryClient}>{tier}</QueryClientProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}

/** First run (or after Change server): only Connect (and the native Setup wizard) is reachable. */
function ConnectGate() {
  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="connect" />
      {/* Pushed from Connect when the probe returns needsSetup — the native Setup wizard. */}
      <Stack.Screen name="setup" />
      {/*
       * Password-link redemption — the new-Member case. The deep link arrives when the app
       * is freshly installed with no stored server origin, so ConnectGate must include it.
       * The screen derives the origin from the `origin` query param (present on both the
       * custom-scheme and Universal-Link entry paths — see screens/set-password/index.tsx).
       */}
      <Stack.Screen name="set-password/[token]" />
      <Stack.Protected guard={false}>
        <Stack.Screen name="paywall" />
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="meals/[id]" />
        <Stack.Screen name="admin" />
      </Stack.Protected>
    </Stack>
  );
}

/**
 * Past Connect, before everything else: the unlock tier. No trial yet (the start screen) or trial
 * over without the unlock (the hard lock) — one screen reads which off the same entitlement store.
 * On a cold start the splash holds until the cached CustomerInfo resolves, same contract as the
 * session tiers below.
 */
function PaywallGate({ loading }: { loading: boolean }) {
  useEffect(() => {
    if (!loading) void SplashScreen.hideAsync();
  }, [loading]);

  if (loading) return <GateLoading />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="paywall" />
      <Stack.Protected guard={false}>
        <Stack.Screen name="connect" />
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="meals/[id]" />
        <Stack.Screen name="admin" />
      </Stack.Protected>
    </Stack>
  );
}

/**
 * Past Connect: the session + onboarding tiers. The onboarding tier mirrors web's `requireOnboarded`
 * ("has ≥1 snapshot" via `/me` — ADR 0001/0011); the same primed query is what the wizard invalidates
 * to flip the gate. Sign-out flips `useSession()` and the gate swaps to sign-in.
 */
function SessionGate() {
  const { data: session, isPending } = getAuthClient().useSession();
  const meQuery = useQuery({ ...meQueryOptions(), enabled: !!session });

  // The splash holds through BOTH reads on a cold start (cached session → /me), so an onboarded
  // Member lands straight on Today with no sign-in or wizard flash.
  const settled = !isPending && (!session || !meQuery.isPending);
  useEffect(() => {
    if (settled) void SplashScreen.hideAsync();
  }, [settled]);

  if (isPending) return null;
  if (session && meQuery.isPending) return <GateLoading />;
  if (session && meQuery.isError) {
    return (
      <GateError
        onRetry={() => void meQuery.refetch()}
        onChangeServer={() => {
          queryClient.clear();
          setServerUrl(null);
        }}
      />
    );
  }

  const isOnboarded = meQuery.data?.isOnboarded ?? false;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={false}>
        <Stack.Screen name="connect" />
      </Stack.Protected>
      <Stack.Protected guard={!!session && isOnboarded}>
        <Stack.Screen name="(app)" />
        <Stack.Screen name="meals/[id]" options={{ presentation: 'formSheet' }} />
        {/* Pushed over the tabs (NativeTabs only navigates declared triggers — same as the meal
            detail). The Host-only gate is the Profile row + the server's uniform 404 scoping
            (ADR 0013); a member deep-linking here just sees empty queries 404. */}
        <Stack.Screen name="admin" />
        {/* The early unlock, pushed from Profile's trial row (the screen's `trial` mode). */}
        <Stack.Screen name="paywall" options={{ presentation: 'formSheet' }} />
        {/* A signed-in Host can click a test link they just issued — the screen handles it
            gracefully (redemption succeeds → sign-in is skipped because they already have a
            session; the gate stays put). Also covers Members switching from an old link. */}
        <Stack.Screen name="set-password/[token]" />
      </Stack.Protected>
      <Stack.Protected guard={!!session && !isOnboarded}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}
