/**
 * Query keys and queryOptions for the Admin screen.
 * Port of apps/web/src/routes/admin/-queries.ts.
 */

import { queryOptions } from '@tanstack/react-query';

import { getClient, run } from '@/client/api-client';

import type { MemberView } from '@sufra-web/worker/views/member.ts';

export { type MemberView as Member };

export const adminMembersKey = ['admin', 'members'] as const;
export const adminSettingsKey = ['admin', 'settings'] as const;
export const adminInferenceCostKey = (range: { from: string; to: string }) =>
  ['admin', 'inference-cost', range.from, range.to] as const;

export function membersQueryOptions() {
  return queryOptions({
    queryKey: adminMembersKey,
    queryFn: async () => {
      const client = await getClient();
      return run(client.members.index());
    },
  });
}

export function inferenceCostQueryOptions(range: { from: string; to: string }) {
  return queryOptions({
    queryKey: adminInferenceCostKey(range),
    queryFn: async () => {
      const client = await getClient();
      return run(client.cost.show({ query: range }));
    },
  });
}

export function settingsQueryOptions() {
  return queryOptions({
    queryKey: adminSettingsKey,
    queryFn: async () => {
      const client = await getClient();
      return run(client.settings.show());
    },
  });
}

/**
 * Current calendar month in the Host's local TZ, mapped to UTC instants for the server-side range.
 * TZ logic lives on the client; the server only sees a UTC range.
 */
export function monthRangeUtc(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { from: from.toISOString(), to: to.toISOString() };
}
