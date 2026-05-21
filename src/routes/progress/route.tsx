import { useRef, type ChangeEvent } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, redirect } from "@tanstack/react-router"

import { BottomNav } from "@/components/bottom-nav"
import { useAuth } from "@/lib/auth-context"
import type { ProfileSnapshot } from "../../../worker/profile/schema"
import { CaptureFab } from "../index/-components/capture-fab"
import { BmiCard } from "./-components/bmi-card"
import { CaloriesCard } from "./-components/calories-card"
import { WeightCard } from "./-components/weight-card"
import {
  calorieHistoryQueryOptions,
  weightsQueryOptions,
} from "./-queries"
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
  beforeLoad: ({ context }) => {
    if (!context.auth.session) throw redirect({ to: "/login" })
  },
  loader: ({ context, deps }) => {
    return Promise.all([
      context.queryClient.ensureQueryData(weightsQueryOptions(deps.wp)),
      context.queryClient.ensureQueryData(calorieHistoryQueryOptions(deps.cp)),
    ])
  },
  component: ProgressView,
})

function ProgressView() {
  const auth = useAuth()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // The onboarding gate guarantees a profile exists by the time we reach
  // this route — same invariant as the Profile page.
  const latest = auth.profiles[0] as ProfileSnapshot | undefined
  const wp = search.wp ?? DEFAULT_WEIGHT_PERIOD
  const cp = search.cp ?? DEFAULT_CALORIE_PERIOD

  const setWp = (p: WeightPeriod) =>
    navigate({ search: { ...search, wp: p }, replace: true })
  const setCp = (p: CaloriePeriod) =>
    navigate({ search: { ...search, cp: p }, replace: true })

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append("photo", file)
      const res = await fetch("/api/meals", { method: "POST", body: formData })
      if (!res.ok) throw new Error("upload_failed")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meals"] })
      queryClient.invalidateQueries({ queryKey: ["calorie-history"] })
    },
  })

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    uploadMutation.mutate(file)
    e.target.value = ""
  }

  if (!latest) return null

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col bg-background pb-40">
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

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      <CaptureFab
        disabled={uploadMutation.isPending}
        label={uploadMutation.isPending ? "Uploading…" : "Log a meal"}
        onClick={() => fileInputRef.current?.click()}
      />
      <BottomNav />
    </div>
  )
}
