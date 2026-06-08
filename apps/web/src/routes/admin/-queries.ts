import { queryOptions } from "@tanstack/react-query"

import { getClient, run } from "@/client/api-client"
import type { MemberView } from "@/worker/views/member"
import type { CostView } from "@/worker/views/cost"
import type { SettingsView } from "@/worker/views/setting"

export const adminMembersKey = ["admin", "members"] as const
export const adminSettingsKey = ["admin", "settings"] as const
export const adminInferenceCostKey = (range: { from: string; to: string }) =>
  ["admin", "inference-cost", range.from, range.to] as const

export function membersQueryOptions() {
  return queryOptions({
    queryKey: adminMembersKey,
    queryFn: async (): Promise<ReadonlyArray<MemberView>> => run((await getClient()).members.index()),
  })
}

export function inferenceCostQueryOptions(range: { from: string; to: string }) {
  return queryOptions({
    queryKey: adminInferenceCostKey(range),
    queryFn: async (): Promise<CostView> => run((await getClient()).cost.show({ query: range })),
  })
}

export function settingsQueryOptions() {
  return queryOptions({
    queryKey: adminSettingsKey,
    queryFn: async (): Promise<SettingsView> => run((await getClient()).settings.show()),
  })
}

// Current calendar month in the Host's local TZ, mapped to UTC instants for the server-side range. Same
// pattern as the Day view's weekRange — TZ logic lives on the client, the server only sees a UTC range.
export function monthRangeUtc(): { from: string; to: string } {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return { from: from.toISOString(), to: to.toISOString() }
}

export type Member = MemberView
