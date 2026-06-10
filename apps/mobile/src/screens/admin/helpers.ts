/**
 * Native share-sheet helper for handing off a Password link to a new Member.
 * Port of apps/web/src/routes/admin/-helpers.ts — on RN the share sheet replaces
 * clipboard as the out-of-band handover mechanism (WhatsApp, iMessage, group chat, etc.).
 */

import { Alert, Share } from 'react-native';

import { getServerUrl } from '@/client/server';

/**
 * Build the join message and open the native share sheet — the Host pastes it anywhere (WhatsApp,
 * iMessage, group chat). The set-password URL targets the connected server origin (ADR 0018); the
 * link expires in 24h (ADR 0016).
 */
export async function sharePasswordLinkMessage(username: string, token: string) {
  const origin = getServerUrl() ?? '';
  const url = `${origin}/set-password/${token}`;
  const message = `Hi ${username}, here's your link to join Sufra:\n${url}`;
  try {
    await Share.share({ message });
  } catch {
    // The share sheet failing to open is rare; surface the message so the Host can still relay it.
    Alert.alert("Couldn't open the share sheet", message);
  }
}
