import { useRouter } from 'expo-router';
import * as Updates from 'expo-updates';
import { useState } from 'react';
import { Alert, DevSettings, I18nManager } from 'react-native';
import { t, plural } from '@lingui/core/macro';

import { getAuthClient } from '@/client/auth-client';
import { trialDaysLeft, unlockGated, useEntitlement } from '@/client/entitlement';
import { queryClient } from '@/client/query-client';
import { getServerUrl, setServerUrl } from '@/client/server';
import { getLocale, setLocale, useLocale, type AppLocale } from '@/lib/locale';
import { OptionSheet } from './option-sheet';
import { Row, SectionCard } from './section-card';

export function AccountSection({ username, isHost }: { username: string; isHost: boolean }) {
  const router = useRouter();
  // Changing servers signs out first (the SecureStore cookie jar is shared across origins — a stale
  // cookie must not replay against the next backend), clears the query cache, then drops the origin;
  // the root gate flips back to Connect (ADR 0018).
  const changeServer = () => {
    Alert.alert(
      t`Change server?`,
      t`You'll be signed out, and this device will forget the current server.`,
      [
        { text: t`Cancel`, style: 'cancel' },
        {
          text: t`Change server`,
          style: 'destructive',
          onPress: () => {
            void getAuthClient()
              .signOut()
              .catch(() => {
                // Best-effort: an unreachable server must not block leaving it.
              })
              .finally(() => {
                queryClient.clear();
                setServerUrl(null);
              });
          },
        },
      ]
    );
  };

  return (
    <SectionCard label={t`Account`}>
      <Row label={t`Username`} value={username} />
      <Row label={t`Server`} value={getServerUrl() ?? ''} onPress={changeServer} labelClassName="text-flame" />
      <LanguageRow />
      {/* The row is UX only — the real Host gate is the server's uniform 404 scoping (ADR 0013). */}
      {isHost && <Row label={t`Admin`} value="" onPress={() => router.push('/admin')} labelClassName="text-flame" />}
      <UnlockRow />
    </SectionCard>
  );
}

// A language names itself in itself — these labels are deliberately NOT translated.
const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'العربية' },
] as const satisfies readonly { value: AppLocale; label: string }[];

/**
 * The Language row (ADR 0020) — the inline-commit OptionSheet, like Sex/Activity. Locale and
 * direction are BOOT state (I18nManager flags apply at launch; the Lingui catalog activates at
 * import), so a switch persists the Locale, sets the native flags, and immediately reloads the
 * app — one clean transition, never Arabic strings in an LTR shell.
 */
function LanguageRow() {
  const locale = useLocale();
  const [open, setOpen] = useState(false);

  const switchTo = (next: AppLocale) => {
    setOpen(false);
    if (next === getLocale()) return;
    setLocale(next);
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(next === 'ar');
    if (__DEV__) DevSettings.reload();
    else void Updates.reloadAsync();
  };

  return (
    <>
      <Row
        label={t`Language`}
        value={locale === 'ar' ? 'العربية' : 'English'}
        onPress={() => setOpen(true)}
        labelClassName="text-flame"
      />
      <OptionSheet
        visible={open}
        title={t`Language`}
        options={LANGUAGE_OPTIONS}
        selected={locale}
        onSelect={switchTo}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

/**
 * The purchase state, VoiceInk-style ("N days left in trial" + a way to buy): during the trial the
 * row pushes the paywall's early-unlock sheet; once purchased it's a quiet fact. Hidden on builds
 * where the gate is bypassed (Android, missing key) — there's nothing to sell there.
 */
function UnlockRow() {
  const router = useRouter();
  const entitlement = useEntitlement();
  if (!unlockGated) return null;

  if (entitlement.kind === 'trial') {
    const days = trialDaysLeft(entitlement.endsAt);
    return (
      <Row
        label={t`Unlock Sufra`}
        value={t`Trial · ${plural(days, { one: '# day left', other: '# days left' })}`}
        onPress={() => router.push('/paywall')}
        labelClassName="text-flame"
      />
    );
  }
  if (entitlement.kind === 'unlocked') return <Row label={t`Sufra`} value={t`Unlocked`} />;
  // 'loading' (a cold-start tick) — and the gate never lets 'trialAvailable'/'expired' reach here.
  return null;
}
