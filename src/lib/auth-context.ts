import { createContext, useContext } from "react"

import type { ProfileSnapshot } from "../../worker/profile/derive"
import type { Session } from "./auth-client"

export type AuthValue = {
  session: Session | null
  needsSetup: boolean
  // Member's full Profile snapshot timeline (sorted DESC by effective_from).
  // Empty array means "no profile yet" — onboarding gate triggers.
  // See ADR 0001.
  profiles: ProfileSnapshot[]
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthValue | null>(null)

export function useAuth(): AuthValue {
  const v = useContext(AuthContext)
  if (!v) throw new Error("useAuth must be used inside <AuthProvider>")
  return v
}
