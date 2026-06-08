import { queryOptions } from "@tanstack/react-query"
import { getPublicClient, run } from "./api-client"
import type { SetupStatusView } from "@/worker/views/setup"

/**
 * The Setup status (`GET /api/setup`, public) — whether the deploy still needs its first Host. The gate
 * signal (Setup tier sits ABOVE the onboarding tier in `gate.ts`). `staleTime: Infinity` because it flips
 * exactly once, at Setup, and the Setup route invalidates this key on success — so the next gate read sees
 * the Host exists and stops routing to `/setup`.
 */
export const setupStatusKey = ["setup-status"] as const

export function setupStatusQueryOptions() {
  return queryOptions({
    queryKey: setupStatusKey,
    queryFn: async (): Promise<SetupStatusView> => run((await getPublicClient()).setup.show()),
    staleTime: Infinity
  })
}
