import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"

import { Button } from "@/components/ui/button"
import { authClient } from "@/client/auth-client"
import { getClient, run } from "@/client/api-client"
import { meKey, meQueryOptions } from "@/client/me"
import { formatLocalDate, todayLocal } from "@/lib/date"
import { StepActivity } from "./-components/step-activity"
import { StepBirthday } from "./-components/step-birthday"
import { StepGoal } from "./-components/step-goal"
import { StepHeight } from "./-components/step-height"
import { StepSex } from "./-components/step-sex"
import { StepWeight } from "./-components/step-weight"
import { BackButton, Dots, Shell } from "./-components/wizard-shell"
import { INITIAL_DRAFT, isStepValid, type Draft, type Step } from "./-types"

export const Route = createFileRoute("/onboarding/")({
  // Onboarding is the destination, not a gated route: require a session, but bounce an already-onboarded
  // account back to the Day view (no loop). Primes `/me` so the check + the wizard share one fetch.
  beforeLoad: async ({ context }) => {
    const { data } = await authClient.getSession()
    if (!data) throw redirect({ to: "/login" })
    const me = await context.queryClient.ensureQueryData(meQueryOptions())
    if (me.isOnboarded) throw redirect({ to: "/" })
  },
  component: Onboarding,
})

function Onboarding() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>(1)
  const [draft, setDraft] = useState<Draft>(INITIAL_DRAFT)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const update = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }))

  const goNext = () =>
    setStep((s) => (s < 6 ? ((s + 1) as Step) : s))
  const goBack = () =>
    setStep((s) => (s > 1 ? ((s - 1) as Step) : s))

  const submit = async () => {
    if (
      !draft.sex ||
      !draft.birthday ||
      draft.heightCm == null ||
      draft.weightKg == null ||
      !draft.activityLevel ||
      draft.goalWeightKg == null
    ) {
      setSubmitError("Some fields are still empty.")
      return
    }
    setSubmitError(null)
    setIsSubmitting(true)
    try {
      // The first POST /profile-snapshots IS onboarding (ADR 0011): applies same-day (effectiveFrom =
      // today) and the server seeds the first Weight measurement.
      await run(
        (await getClient()).profileSnapshots.create({
          payload: {
            sex: draft.sex,
            birthday: draft.birthday,
            heightCm: draft.heightCm,
            displayHeightUnit: draft.displayHeightUnit,
            weightKg: draft.weightKg,
            displayWeightUnit: draft.displayWeightUnit,
            activityLevel: draft.activityLevel,
            goalWeightKg: draft.goalWeightKg,
            weeklyRateKg: draft.weeklyRateKg,
            effectiveFrom: formatLocalDate(todayLocal())
          }
        })
      )
      // `refetchType: "all"` is load-bearing: nothing observes `/me` during onboarding, so a default
      // (active-only) invalidate wouldn't refetch it — the Day view's gate would then read the stale
      // not-onboarded cache and bounce back here. Force + await the refetch so the gate sees onboarded.
      await queryClient.invalidateQueries({ queryKey: meKey, refetchType: "all" })
      void navigate({ to: "/" })
    } catch (e) {
      setSubmitError(`Error: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Implicit submit: Enter on the soft keyboard (or the on-screen "Go" key)
  // fires this and advances, so number-input steps don't require dismissing
  // the keyboard first and then tapping Continue.
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!isStepValid(step, draft) || isSubmitting) return
    if (step === 6) void submit()
    else goNext()
  }

  return (
    <Shell>
      <form onSubmit={handleSubmit} className="flex flex-1 flex-col">
        <header className="flex items-center gap-3">
          <BackButton onClick={goBack} disabled={step === 1 || isSubmitting} />
          <Dots count={6} current={step} />
        </header>

        <main className="mt-8 flex-1">
          {step === 1 && (
            <StepSex
              value={draft.sex}
              onChange={(v) => {
                update("sex", v)
                goNext()
              }}
            />
          )}
          {step === 2 && (
            <StepBirthday
              value={draft.birthday}
              onChange={(v) => update("birthday", v)}
            />
          )}
          {step === 3 && (
            <StepHeight
              heightCm={draft.heightCm}
              unit={draft.displayHeightUnit}
              onHeightChange={(cm) => update("heightCm", cm)}
              onUnitChange={(u) => update("displayHeightUnit", u)}
            />
          )}
          {step === 4 && (
            <StepWeight
              weightKg={draft.weightKg}
              unit={draft.displayWeightUnit}
              onWeightChange={(kg) => {
                update("weightKg", kg)
                // Keep goal weight in sync with current weight until the
                // Member explicitly moves the slider in step 6. Without this,
                // typing "93.5" intermediate-fires onWeightChange(93) which
                // pinned goalWeightKg=93 while weightKg later became 93.5 —
                // a stuck-at-intermediate misalignment.
                update("goalWeightKg", kg)
              }}
              onUnitChange={(u) => update("displayWeightUnit", u)}
            />
          )}
          {step === 5 && (
            <StepActivity
              value={draft.activityLevel}
              onChange={(v) => update("activityLevel", v)}
            />
          )}
          {step === 6 && (
            <StepGoal
              draft={draft}
              onGoalWeightChange={(kg) => update("goalWeightKg", kg)}
              onRateChange={(r) => update("weeklyRateKg", r)}
            />
          )}
        </main>

        {step !== 1 && (
          <footer className="mt-6 flex flex-col gap-2">
            {submitError && (
              <p className="text-sm text-destructive">{submitError}</p>
            )}
            <Button
              type="submit"
              size="lg"
              disabled={!isStepValid(step, draft) || isSubmitting}
            >
              {step === 6
                ? isSubmitting
                  ? "Saving…"
                  : "Finish"
                : "Continue"}
            </Button>
          </footer>
        )}
      </form>
    </Shell>
  )
}
