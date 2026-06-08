import type { QueryClient } from "@tanstack/react-query"
import { redirect } from "@tanstack/react-router"
import { authClient } from "./auth-client"
import { meQueryOptions } from "./me"
import { setupStatusQueryOptions } from "./setup"

/** The role on the current session — defaulted defensively (the admin plugin sets it; absent ⇒ member). */
const roleOf = (user: unknown): string => (user as { role?: string | null }).role ?? "member"

/**
 * The protected-route gate — three tiers, checked top-down: Setup (no Host yet → `/setup`), Login (no
 * session → `/login`), Onboarding (signed in, no Profile yet → `/onboarding`, "has ≥1 snapshot", ADR
 * 0001/0011). Primes `/me` in the cache so the page reuses it with no second fetch. Call from a protected
 * route's `beforeLoad`. (`/login`, `/onboarding`, `/setup`, `/set-password/*`, `/how-it-works` stay
 * ungated — they're the bootstrap touchpoints.)
 */
export async function requireOnboarded(queryClient: QueryClient): Promise<void> {
  const status = await queryClient.ensureQueryData(setupStatusQueryOptions())
  if (status.needsSetup) throw redirect({ to: "/setup" })
  const { data } = await authClient.getSession()
  if (!data) throw redirect({ to: "/login" })
  const me = await queryClient.ensureQueryData(meQueryOptions())
  if (!me.isOnboarded) throw redirect({ to: "/onboarding" })
}

/**
 * The host-only gate (the `/admin` surface). Setup tier first (no Host → `/setup`), then session (none →
 * `/login`), then role: a non-host is bounced to `/` (the client mirror of the server's HostOnly 404 — the
 * backend is the real gate, this just avoids rendering a page that would 404 its data). Does NOT prime `/me`.
 */
export async function requireHost(queryClient: QueryClient): Promise<void> {
  const status = await queryClient.ensureQueryData(setupStatusQueryOptions())
  if (status.needsSetup) throw redirect({ to: "/setup" })
  const { data } = await authClient.getSession()
  if (!data) throw redirect({ to: "/login" })
  if (roleOf(data.user) !== "host") throw redirect({ to: "/" })
}
