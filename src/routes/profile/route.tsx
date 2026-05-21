import { useMemo } from "react"
import { createFileRoute, redirect } from "@tanstack/react-router"

import { BottomNav } from "@/components/bottom-nav"
import { useAuth } from "@/lib/auth-context"
import { deriveProfile } from "../../../worker/profile/isomorphic/derive"
import type { ProfileSnapshot } from "../../../worker/profile/schema"
import { AboutYouSection } from "./-components/about-you-section"
import { AccountSection } from "./-components/account-section"
import { GoalSection } from "./-components/goal-section"
import { YourNumbersSection } from "./-components/your-numbers-section"

export const Route = createFileRoute("/profile")({
  beforeLoad: ({ context }) => {
    if (!context.auth.session) throw redirect({ to: "/login" })
  },
  component: Profile,
})

function Profile() {
  const auth = useAuth()
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
  if (!latest || !derived) return null
  const hasPending = latest.effectiveFrom > todayLocalDateStr

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col bg-background pb-24">
      <header className="px-6 pt-6 pb-4">
        <h1 className="font-heading text-2xl font-semibold">Profile</h1>
        <p className="text-sm text-muted-foreground">Your account and plan</p>
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
      </main>

      <BottomNav />
    </div>
  )
}
