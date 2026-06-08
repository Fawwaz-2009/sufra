import { useMemo } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { LogOut } from "lucide-react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { PoweredBy } from "@/components/powered-by"
import { authClient } from "@/client/auth-client"
import { requireOnboarded } from "@/client/gate"
import { meQueryOptions } from "@/client/me"
import { deriveProfile } from "@/worker/views/derive"
import { AboutYouSection } from "./-components/about-you-section"
import { AccountSection } from "./-components/account-section"
import { GoalSection } from "./-components/goal-section"
import { SavedMealsSection } from "./-components/saved-meals-section"
import { YourNumbersSection } from "./-components/your-numbers-section"

export const Route = createFileRoute("/profile")({
  beforeLoad: ({ context }) => requireOnboarded(context.queryClient),
  loader: ({ context }) => context.queryClient.ensureQueryData(meQueryOptions()),
  component: Profile,
})

function Profile() {
  const navigate = useNavigate()
  const me = useSuspenseQuery(meQueryOptions()).data
  // The onboarding gate guarantees a profile by the time we reach this route (profiles[0] is the latest).
  const latest = me.profiles[0]
  const derived = useMemo(() => (latest ? deriveProfile(latest) : null), [latest])
  const todayLocalDateStr = useMemo(() => {
    const t = new Date()
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`
  }, [])

  const handleSignOut = async () => {
    await authClient.signOut()
    void navigate({ to: "/login" })
  }

  if (!latest || !derived) return null
  const hasPending = latest.effectiveFrom > todayLocalDateStr

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col bg-background pb-24">
      <header className="flex items-start justify-between gap-3 px-6 pt-6 pb-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Profile</h1>
          <p className="text-sm text-muted-foreground">Your account and plan</p>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          aria-label="Sign out"
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <LogOut className="size-5" strokeWidth={2.5} />
        </button>
      </header>

      <main className="flex flex-col gap-6 px-6">
        <AboutYouSection profile={latest} />
        <GoalSection profile={latest} />
        <YourNumbersSection targetKcal={derived.targetKcal} macros={derived.macros} hasPending={hasPending} />
        <AccountSection username={me.username} />
        <SavedMealsSection />
        <PoweredBy />
      </main>
    </div>
  )
}
