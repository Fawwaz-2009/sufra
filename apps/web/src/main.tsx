import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from "sonner"

import "./index.css"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { InnerApp } from "./inner-app"
import { AuthProvider } from "@/lib/auth-provider"
import { queryClient } from "@/lib/query-client"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <InnerApp />
        </AuthProvider>
        <Toaster
          position="top-center"
          richColors
          closeButton
          // env(safe-area-inset-top) keeps the toast clear of iPhone's
          // notch/Dynamic Island in PWA standalone mode. Without this it
          // hides behind the bezel. `mobileOffset` is Sonner's mobile-
          // specific override; `offset` covers the desktop fallback.
          offset={{ top: "max(1rem, env(safe-area-inset-top, 0px) + 0.5rem)" }}
          mobileOffset={{
            top: "max(0.75rem, env(safe-area-inset-top, 0px) + 0.5rem)",
          }}
        />
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>
)
