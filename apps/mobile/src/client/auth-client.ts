import { expoClient } from '@better-auth/expo/client';
import { usernameClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';

/**
 * The native Better Auth client — the SECOND client of the same Worker (the web SPA is the first).
 *
 * Session transport is cookie-REPLAY, not bearer: `expoClient` captures the Set-Cookie into SecureStore
 * and replays it as a Cookie header, so the Worker's `auth.api.getSession` bridge is unchanged. The
 * cached session rehydrates synchronously on launch (`SecureStore.getItem`), so `useSession()` settles
 * with no spinner past the splash.
 *
 * Matches the server's no-email setup: sign-in is `authClient.signIn.username(...)`. Deliberately NO
 * adminClient / `ac` / roles — Sufra's authorization is domain-side (uniform 404 scoping, ADR 0013), NOT
 * Better Auth's access-control machinery, so the role set never needs to cross to the client. When a
 * host-vs-member surface lands (M4/M5), `role` is read as a plain field off the session.
 *
 * `cookieCache` is left OFF and the bearer plugin is NOT added — cookie-replay is the supported path and
 * `cookieCache` can clobber the rolling session's `expiresAt`.
 */
export const authClient = createAuthClient({
  // The Worker origin (Better Auth appends /api/auth). The cloudflared tunnel in dev; the deployed
  // origin in production. Set via apps/mobile/.env (EXPO_PUBLIC_* is inlined at build time).
  baseURL: process.env.EXPO_PUBLIC_API_URL,
  plugins: [
    expoClient({ scheme: 'sufra', storagePrefix: 'sufra', storage: SecureStore }),
    usernameClient(),
  ],
});

export type Session = typeof authClient.$Infer.Session;
