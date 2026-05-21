import { RouterProvider } from "@tanstack/react-router"

import { useAuth } from "@/lib/auth-context"
import { queryClient } from "@/lib/query-client"
import { router } from "./router"

export function InnerApp() {
  const auth = useAuth()
  return <RouterProvider router={router} context={{ queryClient, auth }} />
}
