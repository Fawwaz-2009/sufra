import { getLocales } from 'expo-localization';

/**
 * The Locale (CONTEXT.md / ADR 0020) — CLIENT state that follows the DEVICE/OS language. The in-app
 * Language toggle was removed: React Native can't reliably switch layout DIRECTION at runtime (the New
 * Architecture governs LTR/RTL from the OS language at native launch), so strings AND direction both
 * follow the device, kept in agreement — an English-strings-in-an-RTL-shell mismatch is the bug that
 * motivated this. A user who wants the other language switches it for the device (or, once the app
 * ships `CFBundleLocalizations`, via iOS Settings → Sufra → Language, which relaunches cleanly).
 *
 * Read synchronously by the boot modules — lib/rtl.ts (direction) + lib/i18n.ts (catalog) — before the
 * first render, and ridden on the Estimate-creating request so the AI answers in the Member's
 * language. Never stored by the server.
 */
export const SUPPORTED_LOCALES = ['en', 'ar'] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

let cached: AppLocale | undefined;

function read(): AppLocale {
  if (cached === undefined) {
    cached = getLocales()[0]?.languageCode === 'ar' ? 'ar' : 'en';
  }
  return cached;
}

export function getLocale(): AppLocale {
  return read();
}
