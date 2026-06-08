import type { QueryClient } from "@tanstack/react-query"
import { redirect } from "@tanstack/react-router"
import { authClient } from "./auth-client"
import { meQueryOptions } from "./me"

/**
 * The protected-route gate (Slice 2's per-route `getSession` gate + the onboarding tier). Redirects to
 * `/login` when there's no session, then to `/onboarding` for a signed-in account with no Profile yet
 * ("has ≥1 snapshot" — ADR 0001/0011). It primes `/me` in the query cache so the page reuses it (the Day
 * Summary panel, the Profile page) with no second fetch. Call it from a protected route's `beforeLoad`.
 *
 * The Setup gate (no Host yet → `/setup`) returns with Slice 4; `/login`, `/onboarding`, `/how-it-works`
 * etc. stay ungated (they're the bootstrap touchpoints).
 */
export async function requireOnboarded(queryClient: QueryClient): Promise<void> {
  const { data } = await authClient.getSession()
  if (!data) throw redirect({ to: "/login" })
  const me = await queryClient.ensureQueryData(meQueryOptions())
  if (!me.isOnboarded) throw redirect({ to: "/onboarding" })
}
