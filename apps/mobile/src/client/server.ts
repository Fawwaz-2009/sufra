import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';

/**
 * The server origin — USER STATE, not a build-time constant (ADR 0018). v1 is bring-your-own-backend:
 * the Member enters their household's Worker URL on the Connect screen, the app probes it, and the
 * origin lives in SecureStore next to the session. `EXPO_PUBLIC_API_URL` is only the dev prefill on
 * that screen — it is never read as a fallback here.
 *
 * `SecureStore.getItem` is synchronous, so the gate reads the origin with no spinner on launch
 * (the same property the cookie jar relies on). Module-scope cache + `useSyncExternalStore` so the
 * root gate re-renders when Connect (or Change server) flips the origin.
 */
const SERVER_URL_KEY = 'sufra.server-url';

let cached: string | null | undefined;
const listeners = new Set<() => void>();

function read(): string | null {
  if (cached === undefined) cached = SecureStore.getItem(SERVER_URL_KEY);
  return cached;
}

export function getServerUrl(): string | null {
  return read();
}

export function setServerUrl(url: string | null): void {
  cached = url;
  if (url === null) void SecureStore.deleteItemAsync(SERVER_URL_KEY);
  else SecureStore.setItem(SERVER_URL_KEY, url);
  listeners.forEach((notify) => notify());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The root gate's reactive read — flips the Connect tier when the origin is set or cleared. */
export function useServerUrl(): string | null {
  return useSyncExternalStore(subscribe, read);
}

/**
 * "Force https, strip trailing slash" (ADR 0018) — https is the DEFAULT scheme when none is typed
 * (`family.example.com` → `https://family.example.com`), but an explicit `http://` survives: the dev
 * loop points at `http://localhost:5173` through `adb reverse`, and a self-hoster pasting an explicit
 * scheme knows what they wrote.
 */
export function normalizeServerUrl(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, '');
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}
