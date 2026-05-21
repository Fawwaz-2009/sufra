import { queryOptions } from "@tanstack/react-query"

import { api } from "@/lib/api"

export const adminMembersKey = ["admin", "members"] as const
export const adminSettingsKey = ["admin", "settings"] as const
export const adminInferenceCostKey = (range: { from: string; to: string }) =>
  ["admin", "inference-cost", range.from, range.to] as const

export function membersQueryOptions() {
  return queryOptions({
    queryKey: adminMembersKey,
    queryFn: async () => {
      const res = await api.api.admin.members.$get()
      if (!res.ok) throw new Error("failed_to_load_members")
      const json = await res.json()
      if ("error" in json) throw new Error(String(json.error))
      return json
    },
  })
}

export function inferenceCostQueryOptions(range: {
  from: string
  to: string
}) {
  return queryOptions({
    queryKey: adminInferenceCostKey(range),
    queryFn: async () => {
      const res = await api.api.admin["inference-cost"].$get({
        query: { from: range.from, to: range.to },
      })
      if (!res.ok) throw new Error("failed_to_load_cost")
      const json = await res.json()
      if ("error" in json) throw new Error(json.error)
      return json
    },
  })
}

export function settingsQueryOptions() {
  return queryOptions({
    queryKey: adminSettingsKey,
    queryFn: async () => {
      const res = await api.api.admin.settings.$get()
      if (!res.ok) throw new Error("failed_to_load_settings")
      const json = await res.json()
      if ("error" in json) throw new Error(json.error)
      return json
    },
  })
}

// Current calendar month in the Host's local TZ, mapped to UTC instants for
// the server-side BETWEEN. Same pattern as the Day view's weekRange — TZ logic
// lives on the client, server only sees a UTC range.
export function monthRangeUtc(): { from: string; to: string } {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return { from: from.toISOString(), to: to.toISOString() }
}

export type Member = {
  id: string
  username: string | null
  createdAt: string
}
