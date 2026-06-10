import { Image } from 'expo-image';

import { getAuthClient } from '@/client/auth-client';
import { getServerUrl } from '@/client/server';

/**
 * The Meal's hero photo — Worker-proxied and authed (ADR 0014). A bare fetch needs the session cookie
 * injected by hand (the same pattern MealCard uses on the Today screen).
 */
export function MealPhoto({ photoUrl }: { photoUrl: string }) {
  const cookie = getAuthClient().getCookie();
  return (
    <Image
      source={{ uri: `${getServerUrl()}${photoUrl}`, headers: { Cookie: cookie } }}
      style={{ width: '100%', aspectRatio: 1, backgroundColor: '#D4D4D8' }}
      contentFit="cover"
    />
  );
}
