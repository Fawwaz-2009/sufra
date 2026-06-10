import { Alert } from 'react-native';

import { getAuthClient } from '@/client/auth-client';
import { queryClient } from '@/client/query-client';
import { getServerUrl, setServerUrl } from '@/client/server';
import { Row, SectionCard } from './section-card';

export function AccountSection({ username }: { username: string }) {
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
      <Row label="Server" value={getServerUrl() ?? ''} onPress={changeServer} />
    </SectionCard>
  );
}
