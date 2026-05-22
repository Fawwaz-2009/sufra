import { useMemo } from "react"
import { SignOut } from "@phosphor-icons/react"
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"

import { BottomNav } from "@/components/bottom-nav"
import { PoweredBy } from "@/components/powered-by"
import { useAuth } from "@/lib/auth-context"
import { deriveProfile } from "../../../worker/profile/isomorphic/derive"
import type { ProfileSnapshot } from "../../../worker/profile/schema"
import { AboutYouSection } from "./-components/about-you-section"
import { AccountSection } from "./-components/account-section"
import { GoalSection } from "./-components/goal-section"
import { SavedMealsSection } from "./-components/saved-meals-section"
import { YourNumbersSection } from "./-components/your-numbers-section"

export const Route = createFileRoute("/profile")({
  beforeLoad: ({ context }) => {
    if (!context.auth.session) throw redirect({ to: "/login" })
  },
  component: Profile,
})

function Profile() {
  const auth = useAuth()
  const navigate = useNavigate()
  // The root onboarding gate guarantees a profile exists by the time we reach
  // this route; if a Member somehow lands here without one, latest is
  // undefined — render an empty shell after hooks run.
  const latest = auth.profiles[0] as ProfileSnapshot | undefined
  const derived = useMemo(
    () => (latest ? deriveProfile(latest) : null),
    [latest]
  )
  const todayLocalDateStr = useMemo(() => {
    const t = new Date()
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`
  }, [])

  const handleSignOut = async () => {
    await auth.signOut()
    void navigate({ to: "/login" })
  }

  if (!latest || !derived) return null
  const hasPending = latest.effectiveFrom > todayLocalDateStr

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col bg-background pb-24">
      <header className="flex items-start justify-between gap-3 px-6 pt-6 pb-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Profile</h1>
          <p className="text-sm text-muted-foreground">
            Your account and plan
          </p>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          aria-label="Sign out"
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <SignOut className="size-5" weight="bold" />
        </button>
      </header>

      <main className="flex flex-col gap-6 px-6">
        <AboutYouSection profile={latest} />
        <GoalSection profile={latest} />
        <YourNumbersSection
          targetKcal={derived.targetKcal}
          macros={derived.macros}
          hasPending={hasPending}
        />
        <AccountSection username={auth.session?.user.username ?? ""} />
        <SavedMealsSection />
        <PoweredBy />
      </main>

      <BottomNav />
    </div>
  )
}
