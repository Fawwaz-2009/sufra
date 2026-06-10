import { queryOptions } from '@tanstack/react-query';

import { getClient, run } from '@/client/api-client';
import type { MeView } from '@sufra-web/worker/views/me.ts';

/**
 * The current account (`GET /me`) — the identity plus the Profile snapshot timeline + `isOnboarded`.
 * Promoted to `client/` (the "second use earns it" rule): read by the root gate's onboarding tier,
 * the Today screen's Day summary, and Settings. The client resolves the active snapshot for a Day +
 * derives Target/macros locally from `profiles` (browser-safe `@sufra-web/worker/views/derive`).
 */
export const meKey = ['me'] as const;

export function meQueryOptions() {
  return queryOptions({
    queryKey: meKey,
    queryFn: async (): Promise<MeView> => run((await getClient()).me.show()),
  });
}
