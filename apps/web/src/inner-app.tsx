import { RouterProvider } from "@tanstack/react-router"

import { queryClient } from "@/lib/query-client"
import { router } from "./router"

export function InnerApp() {
  return <RouterProvider router={router} context={{ queryClient }} />
}
