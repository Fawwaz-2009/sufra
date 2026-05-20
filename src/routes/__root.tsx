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

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: ({ context, location }) => {
    if (context.auth.needsSetup && location.pathname !== "/setup") {
      throw redirect({ to: "/setup" })
    }
    return {
      needsSetup: context.auth.needsSetup,
      session: context.auth.session,
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
