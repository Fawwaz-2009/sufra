import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import type { ProfileSnapshot } from "../../worker/profile/derive"
import { api } from "./api"
import { authClient, type Session } from "./auth-client"
import { AuthContext, type AuthValue } from "./auth-context"

type ProviderState = {
  session: Session | null
  needsSetup: boolean
  profiles: ProfileSnapshot[]
  isOnboarded: boolean
  isLoading: boolean
}

const INITIAL_STATE: ProviderState = {
  session: null,
  needsSetup: false,
  profiles: [],
  isOnboarded: false,
  isLoading: true,
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ProviderState>(INITIAL_STATE)

  const refresh = useCallback(async () => {
    const [setupRes, sessionRes, profileRes] = await Promise.all([
      api.api.setup.status.$get(),
      authClient.getSession(),
      // 401 if no session — that's fine, we treat it as "not onboarded."
      api.api.profile.$get().catch(() => null),
    ])
    const { needsSetup } = await setupRes.json()
    const profileData =
      profileRes && profileRes.ok
        ? ((await profileRes.json()) as {
            profiles: ProfileSnapshot[]
            isOnboarded: boolean
          })
        : { profiles: [], isOnboarded: false }
    setState({
      session: sessionRes.data ?? null,
      needsSetup,
      profiles: profileData.profiles,
      isOnboarded: profileData.isOnboarded,
      isLoading: false,
    })
  }, [])

  const signOut = useCallback(async () => {
    await authClient.signOut()
    setState((prev) => ({
      ...prev,
      session: null,
      profiles: [],
      isOnboarded: false,
    }))
  }, [])

  useEffect(() => {
    // One-shot init: linter flags the indirect setState via refresh(), but the
    // setState fires post-await, not synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
  }, [refresh])

  const value = useMemo<AuthValue>(
    () => ({
      session: state.session,
      needsSetup: state.needsSetup,
      profiles: state.profiles,
      isOnboarded: state.isOnboarded,
      refresh,
      signOut,
    }),
    [
      state.session,
      state.needsSetup,
      state.profiles,
      state.isOnboarded,
      refresh,
      signOut,
    ]
  )

  if (state.isLoading) {
    return (
      <div
        className="bg-background flex min-h-svh items-center justify-center"
        aria-label="Loading"
      >
        <div className="bg-muted h-2 w-32 animate-pulse rounded" />
      </div>
    )
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
