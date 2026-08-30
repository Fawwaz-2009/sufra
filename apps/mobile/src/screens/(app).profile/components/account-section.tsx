import { useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { t, plural } from '@lingui/core/macro';

import { getAuthClient } from '@/client/auth-client';
import { trialDaysLeft, unlockGated, useEntitlement } from '@/client/entitlement';
import { queryClient } from '@/client/query-client';
import { getServerUrl, setServerUrl } from '@/client/server';
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
      {/* The row is UX only — the real Host gate is the server's uniform 404 scoping (ADR 0013). */}
      {isHost && <Row label={t`Admin`} value="" onPress={() => router.push('/admin')} labelClassName="text-flame" />}
      <UnlockRow />
    </SectionCard>
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
