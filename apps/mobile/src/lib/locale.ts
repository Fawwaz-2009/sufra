import { getLocales } from 'expo-localization';
import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';

/**
 * The Locale (CONTEXT.md / ADR 0020) — CLIENT state, the client/server.ts pattern: defaults to the
 * device language on first run, overridable by the explicit Language row in Profile, never stored by
 * the server. `SecureStore.getItem` is synchronous, so the boot modules (lib/rtl.ts direction,
 * lib/i18n.ts activation) read it before the first render with no spinner.
 *
 * `setLocale` only persists + notifies — the Language row owns the I18nManager flags + the app
 * reload (direction is boot state; see lib/rtl.ts).
 */
const LOCALE_KEY = 'sufra.locale';

export const SUPPORTED_LOCALES = ['en', 'ar'] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

const isSupported = (value: string | null): value is AppLocale =>
  value !== null && (SUPPORTED_LOCALES as readonly string[]).includes(value);

function deviceDefault(): AppLocale {
  const language = getLocales()[0]?.languageCode;
  return language === 'ar' ? 'ar' : 'en';
}

let cached: AppLocale | undefined;
const listeners = new Set<() => void>();

function read(): AppLocale {
  if (cached === undefined) {
    const stored = SecureStore.getItem(LOCALE_KEY);
    cached = isSupported(stored) ? stored : deviceDefault();
  }
  return cached;
}

export function getLocale(): AppLocale {
  return read();
}

export function setLocale(locale: AppLocale): void {
  cached = locale;
  SecureStore.setItem(LOCALE_KEY, locale);
  listeners.forEach((notify) => notify());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useLocale(): AppLocale {
  return useSyncExternalStore(subscribe, read);
}
