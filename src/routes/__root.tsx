import type { QueryClient } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import {
  createRootRouteWithContext,
  Outlet,
  redirect,
} from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools"

import type { AuthValue } from "@/lib/auth-context"

interface RouterContext {
  queryClient: QueryClient
  auth: AuthValue
}

// Paths where the Onboarding gate is suppressed even when the Member has no
// profile yet. /onboarding is the destination; the auth-entry paths must
// remain reachable so a Member can sign in (or set their first password)
// before they can be redirected anywhere; /how-it-works is intentionally
// readable mid-onboarding so the ⓘ links in the wizard can deep-link.
const ONBOARDING_EXEMPT_PATHS = new Set([
  "/onboarding",
  "/login",
  "/setup",
  "/how-it-works",
])

function isOnboardingExempt(pathname: string): boolean {
  if (ONBOARDING_EXEMPT_PATHS.has(pathname)) return true
  // /set-password/<token> — token in path, so check prefix.
  if (pathname.startsWith("/set-password/")) return true
  return false
}

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: ({ context, location }) => {
    // Two-tier gate (see ADR 0001):
    //   1. Setup gate — fires when no host exists. Redirects everyone to /setup.
    //   2. Onboarding gate — fires for any signed-in account with no
    //      profile_log row yet. Skipped on the exempt paths above.
    if (context.auth.needsSetup && location.pathname !== "/setup") {
      throw redirect({ to: "/setup" })
    }
    if (
      context.auth.session &&
      !context.auth.isOnboarded &&
      !isOnboardingExempt(location.pathname)
    ) {
      throw redirect({ to: "/onboarding" })
    }
    return {
      needsSetup: context.auth.needsSetup,
      session: context.auth.session,
      profiles: context.auth.profiles,
      isOnboarded: context.auth.isOnboarded,
    }
  },
  component: RootLayout,
})

function RootLayout() {
  return (
    <>
      <Outlet />
      <TanStackRouterDevtools position="bottom-right" />
      <ReactQueryDevtools buttonPosition="bottom-left" />
    </>
  )
}
