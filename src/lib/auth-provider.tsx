import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import { api } from "./api"
import { authClient, type Session } from "./auth-client"
import { AuthContext, type AuthValue } from "./auth-context"

type ProviderState = {
  session: Session | null
  needsSetup: boolean
  isLoading: boolean
}

const INITIAL_STATE: ProviderState = {
  session: null,
  needsSetup: false,
  isLoading: true,
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ProviderState>(INITIAL_STATE)

  const refresh = useCallback(async () => {
    const [setupRes, sessionRes] = await Promise.all([
      api.api.setup.status.$get(),
      authClient.getSession(),
    ])
    const { needsSetup } = await setupRes.json()
    setState({
      session: sessionRes.data ?? null,
      needsSetup,
      isLoading: false,
    })
  }, [])

  const signOut = useCallback(async () => {
    await authClient.signOut()
    setState((prev) => ({ ...prev, session: null }))
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
      refresh,
      signOut,
    }),
    [state.session, state.needsSetup, refresh, signOut]
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
