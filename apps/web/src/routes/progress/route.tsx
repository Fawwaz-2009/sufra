import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { BottomNav } from "@/components/bottom-nav"
import { requireOnboarded } from "@/client/gate"
import { meQueryOptions } from "@/client/me"
import { BmiCard } from "./-components/bmi-card"
import { CaloriesCard } from "./-components/calories-card"
import { WeightCard } from "./-components/weight-card"
import { calorieHistoryQueryOptions, weightsQueryOptions } from "./-queries"
import {
  DEFAULT_CALORIE_PERIOD,
  DEFAULT_WEIGHT_PERIOD,
  progressSearchSchema,
  type CaloriePeriod,
  type WeightPeriod,
} from "./-search"

export const Route = createFileRoute("/progress")({
  validateSearch: (search) => progressSearchSchema.parse(search),
  loaderDeps: ({ search }) => ({
    wp: search.wp ?? DEFAULT_WEIGHT_PERIOD,
    cp: search.cp ?? DEFAULT_CALORIE_PERIOD,
  }),
  // The gate primes /me (the latest Profile snapshot for the chart cards) + enforces Setup/Login/Onboarding.
  beforeLoad: ({ context }) => requireOnboarded(context.queryClient),
  loader: ({ context, deps }) =>
    Promise.all([
      context.queryClient.ensureQueryData(weightsQueryOptions(deps.wp)),
      context.queryClient.ensureQueryData(calorieHistoryQueryOptions(deps.cp)),
    ]),
  component: ProgressView,
})

function ProgressView() {
  const me = useSuspenseQuery(meQueryOptions()).data
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  // The onboarding gate guarantees a profile by the time we reach this route (profiles[0] is the latest).
  const latest = me.profiles[0]
  const wp = search.wp ?? DEFAULT_WEIGHT_PERIOD
  const cp = search.cp ?? DEFAULT_CALORIE_PERIOD

  const setWp = (p: WeightPeriod) => navigate({ search: { ...search, wp: p }, replace: true })
  const setCp = (p: CaloriePeriod) => navigate({ search: { ...search, cp: p }, replace: true })

  if (!latest) return null

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col bg-background pb-24">
      <header className="px-6 pt-6 pb-4">
        <h1 className="font-heading text-2xl font-semibold">Progress</h1>
        <p className="text-sm text-muted-foreground">
          Your intake and progress over time
        </p>
      </header>

      <main className="flex flex-col gap-4 px-5">
        <WeightCard profile={latest} period={wp} onPeriodChange={setWp} />
        <CaloriesCard period={cp} onPeriodChange={setCp} />
        <BmiCard profile={latest} />
      </main>

      <BottomNav />
    </div>
  )
}
