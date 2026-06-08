import { queryOptions } from "@tanstack/react-query"
import { getClient, run } from "./api-client"
import type { MeView } from "@/worker/views/me"

/**
 * The current account (`GET /me`) — the identity plus the Profile snapshot timeline + `isOnboarded`.
 * Promoted to `client/` (the "second use earns it" rule) because it's read by the onboarding gate, the
 * Day Summary panel, the Profile page, and the Log Weight sheet. The SPA resolves the active snapshot for
 * a day + derives Target/macros locally from `profiles` (browser-safe `@/worker/views/derive`).
 */
export const meKey = ["me"] as const

export function meQueryOptions() {
  return queryOptions({
    queryKey: meKey,
    queryFn: async (): Promise<MeView> => run((await getClient()).me.show())
  })
}
