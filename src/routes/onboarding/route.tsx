import { useState } from "react"
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"

import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { formatLocalDate, todayLocal } from "@/lib/date"
import { StepActivity } from "./-components/step-activity"
import { StepBirthday } from "./-components/step-birthday"
import { StepGoal } from "./-components/step-goal"
import { StepHeight } from "./-components/step-height"
import { StepSex } from "./-components/step-sex"
import { StepWeight } from "./-components/step-weight"
import { BackButton, Dots, Shell } from "./-components/wizard-shell"
import { INITIAL_DRAFT, isStepValid, type Draft, type Step } from "./-types"

export const Route = createFileRoute("/onboarding")({
  beforeLoad: ({ context }) => {
    if (!context.auth.session) throw redirect({ to: "/login" })
    if (context.auth.isOnboarded) throw redirect({ to: "/" })
  },
  component: Onboarding,
})

function Onboarding() {
  const auth = useAuth()
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
      const todayLocalDate = formatLocalDate(todayLocal())
      const res = await api.api.onboarding.$post({
        json: {
          sex: draft.sex,
          birthday: draft.birthday,
          heightCm: draft.heightCm,
          displayHeightUnit: draft.displayHeightUnit,
          weightKg: draft.weightKg,
          displayWeightUnit: draft.displayWeightUnit,
          activityLevel: draft.activityLevel,
          goalWeightKg: draft.goalWeightKg,
          weeklyRateKg: draft.weeklyRateKg,
          todayLocalDate,
        },
      })
      if (!res.ok) {
        // Surface the actual error code from the server so we can debug —
        // the generic "Something went wrong" hid problems like the
        // profile_log migration not being applied (which yields a 500 with
        // a DB-level error).
        const body = (await res
          .json()
          .catch(() => ({ error: "unknown" }))) as { error?: string }
        setSubmitError(`Error: ${body.error ?? `HTTP ${res.status}`}`)
        return
      }
      await auth.refresh()
      void navigate({ to: "/" })
    } catch (e) {
      setSubmitError(`Error: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Shell>
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
          {step === 6 ? (
            <Button
              size="lg"
              disabled={!isStepValid(step, draft) || isSubmitting}
              onClick={submit}
            >
              {isSubmitting ? "Saving…" : "Finish"}
            </Button>
          ) : (
            <Button
              size="lg"
              disabled={!isStepValid(step, draft)}
              onClick={goNext}
            >
              Continue
            </Button>
          )}
        </footer>
      )}
    </Shell>
  )
}
