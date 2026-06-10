import { expoClient } from '@better-auth/expo/client';
import { usernameClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';

import { getServerUrl } from '@/client/server';

/**
 * The native Better Auth client — the SECOND client of the same Worker (the web SPA is the first).
 *
 * Session transport is cookie-REPLAY, not bearer: `expoClient` captures the Set-Cookie into SecureStore
 * and replays it as a Cookie header, so the Worker's `auth.api.getSession` bridge is unchanged. The
 * cached session rehydrates synchronously on launch (`SecureStore.getItem`), so `useSession()` settles
 * with no spinner past the splash.
 *
 * A lazy factory MEMOIZED BY ORIGIN, not a module-scope instance (ADR 0018): the client is backend-
 * agnostic, so the `baseURL` is the user-state server origin from `client/server.ts` — which doesn't
 * exist until the Connect tier has run. Callers sit past that gate, so `getAuthClient()` throwing on a
 * missing origin is a programmer error, not a user state. Changing servers swaps the instance; the
 * SecureStore cookie jar (`storagePrefix: 'sufra'`) is shared across origins, which is why Change
 * server signs out first — a stale cookie must not replay against the next backend.
 *
 * Matches the server's no-email setup: sign-in is `signIn.username(...)`. Deliberately NO
 * adminClient / `ac` / roles — Sufra's authorization is domain-side (uniform 404 scoping, ADR 0013), NOT
 * Better Auth's access-control machinery, so the role set never needs to cross to the client.
 *
 * `cookieCache` is left OFF and the bearer plugin is NOT added — cookie-replay is the supported path and
 * `cookieCache` can clobber the rolling session's `expiresAt`.
 */
function buildAuthClient(baseURL: string) {
  return createAuthClient({
    baseURL,
    plugins: [
      expoClient({ scheme: 'sufra', storagePrefix: 'sufra', storage: SecureStore }),
      usernameClient(),
    ],
  });
}

type AuthClient = ReturnType<typeof buildAuthClient>;

let cached: { origin: string; client: AuthClient } | null = null;

export function getAuthClient(): AuthClient {
  const origin = getServerUrl();
  if (!origin) {
    throw new Error('getAuthClient() before the Connect tier set a server origin (ADR 0018)');
  }
  if (cached?.origin !== origin) {
    cached = { origin, client: buildAuthClient(origin) };
  }
  return cached.client;
}

export type Session = AuthClient['$Infer']['Session'];
