import { createContext, useContext } from "react"

import type { ProfileSnapshot } from "../../worker/profile/derive"
import type { Session } from "./auth-client"

export type AuthValue = {
  session: Session | null
  needsSetup: boolean
  // Member's full Profile snapshot timeline (sorted DESC by effective_from).
  // Used by routes that need to resolve "the profile active on day X" —
  // the Onboarding gate uses `isOnboarded` instead, never `profiles.length`.
  profiles: ProfileSnapshot[]
  // Server-derived flag from /api/profile. Source of truth for the
  // Onboarding gate. See ADR 0001 — append-only profile_log means any row
  // implies the Member has onboarded.
  isOnboarded: boolean
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthValue | null>(null)

export function useAuth(): AuthValue {
  const v = useContext(AuthContext)
  if (!v) throw new Error("useAuth must be used inside <AuthProvider>")
  return v
}
