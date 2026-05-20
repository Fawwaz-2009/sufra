import { createContext, useContext } from "react"

import type { Session } from "./auth-client"

export type AuthValue = {
  session: Session | null
  needsSetup: boolean
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthValue | null>(null)

export function useAuth(): AuthValue {
  const v = useContext(AuthContext)
  if (!v) throw new Error("useAuth must be used inside <AuthProvider>")
  return v
}
