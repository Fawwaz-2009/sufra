import type { QueryClient } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import {
  createRootRouteWithContext,
  Link,
  Outlet,
  redirect,
} from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools"

import { api } from "@/lib/api"
import { authClient } from "@/lib/auth-client"

interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async ({ location }) => {
    const [setupRes, sessionRes] = await Promise.all([
      api.api.setup.status.$get(),
      authClient.getSession(),
    ])
    const { needsSetup } = await setupRes.json()
    const session = sessionRes.data

    if (needsSetup && location.pathname !== "/setup") {
      throw redirect({ to: "/setup" })
    }

    return { needsSetup, session }
  },
  component: RootLayout,
})

function RootLayout() {
  return (
    <>
      <nav className="flex gap-4 border-b p-4 text-sm">
        <Link to="/" className="[&.active]:font-bold">
          Home
        </Link>
        <Link to="/about" className="[&.active]:font-bold">
          About
        </Link>
      </nav>
      <Outlet />
      <TanStackRouterDevtools position="bottom-right" />
      <ReactQueryDevtools buttonPosition="bottom-left" />
    </>
  )
}
