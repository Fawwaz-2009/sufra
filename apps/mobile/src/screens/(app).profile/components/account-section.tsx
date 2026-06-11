import { useRouter } from 'expo-router';
import { Alert } from 'react-native';

import { getAuthClient } from '@/client/auth-client';
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
      'Change server?',
      "You'll be signed out, and this device will forget the current server.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Change server',
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
    <SectionCard label="Account">
      <Row label="Username" value={username} />
      <Row label="Server" value={getServerUrl() ?? ''} onPress={changeServer} labelClassName="text-flame" />
      {/* The row is UX only — the real Host gate is the server's uniform 404 scoping (ADR 0013). */}
      {isHost && <Row label="Admin" value="" onPress={() => router.push('/admin')} labelClassName="text-flame" />}
    </SectionCard>
  );
}
