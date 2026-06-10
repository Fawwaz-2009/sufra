import type { QueryClient } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { createRootRouteWithContext, Outlet, useLocation } from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools"

import { InstallGate } from "@/components/install-gate"
import { isDevBypass, isMobile, isStandalone } from "@/lib/standalone"

interface RouterContext {
  queryClient: QueryClient
}

// Paths where the install gate is suppressed. The bootstrap touchpoints — first-time host Setup and
// password-link redemption — must remain reachable in a browser (they return in their slices). For
// Slice 2 the gate covers everything except /login. Everything else (Day view, /meals/...) hides
// behind the gate on mobile until installed.
const INSTALL_GATE_EXEMPT_PATHS = new Set(["/login"])

function isInstallGateExempt(pathname: string): boolean {
  if (INSTALL_GATE_EXEMPT_PATHS.has(pathname)) return true
  if (pathname.startsWith("/set-password/")) return true
  return false
}

function shouldShowInstallGate(pathname: string): boolean {
  // Don't render on the server — the detection APIs are window-only.
  if (typeof window === "undefined") return false
  if (isStandalone()) return false
  if (!isMobile()) return false
  if (isDevBypass()) return false
  if (isInstallGateExempt(pathname)) return false
  return true
}

/**
 * The root layout. The auth gate is per-route (`beforeLoad` → `authClient.getSession()` → redirect
 * /login) rather than a root bootstrap — the Setup + Onboarding gates (which need the profile/admin
 * backends) return in Slices 3-4.
 */
export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
})

function RootLayout() {
  const location = useLocation()

  if (shouldShowInstallGate(location.pathname)) {
    return <InstallGate />
  }

  return (
    <>
      <Outlet />
      <TanStackRouterDevtools position="bottom-right" />
      <ReactQueryDevtools buttonPosition="bottom-left" />
    </>
  )
}
