import { useMemo, useState, type ReactNode } from "react"
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { CaretLeft } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { formatLocalDate, todayLocal } from "@/lib/date"
import {
  cmToImperial,
  imperialToCm,
  kgToLb,
  lbToKg,
} from "@/lib/units"
import { cn } from "@/lib/utils"
import {
  ACTIVITY_MULTIPLIERS,
  deriveProfile,
  type ActivityLevel,
  type Sex,
} from "../../worker/profile/derive"

type Draft = {
  sex: Sex | null
  birthday: string
  heightCm: number | null
  displayHeightUnit: "cm" | "imperial"
  weightKg: number | null
  displayWeightUnit: "kg" | "lb"
  activityLevel: ActivityLevel | null
  goalWeightKg: number | null
  weeklyRateKg: number
}

const INITIAL_DRAFT: Draft = {
  sex: null,
  birthday: "",
  heightCm: null,
  displayHeightUnit: "cm",
  weightKg: null,
  displayWeightUnit: "kg",
  activityLevel: null,
  goalWeightKg: null,
  weeklyRateKg: 0,
}

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
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1)
  const [draft, setDraft] = useState<Draft>(INITIAL_DRAFT)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const update = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }))

  const goNext = () => setStep((s) => (s < 6 ? ((s + 1) as 1 | 2 | 3 | 4 | 5 | 6) : s))
  const goBack = () => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3 | 4 | 5 | 6) : s))

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

function isStepValid(step: number, draft: Draft): boolean {
  switch (step) {
    case 1:
      return draft.sex !== null
    case 2:
      return /^\d{4}-\d{2}-\d{2}$/.test(draft.birthday)
    case 3:
      return draft.heightCm != null && draft.heightCm >= 100 && draft.heightCm <= 250
    case 4:
      return draft.weightKg != null && draft.weightKg >= 30 && draft.weightKg <= 300
    case 5:
      return draft.activityLevel !== null
    case 6: {
      // Maintain (goal = current) is valid with rate = 0; non-maintain needs
      // an explicit rate chip.
      if (draft.goalWeightKg == null || draft.weightKg == null) return false
      const isMaintain = Math.abs(draft.goalWeightKg - draft.weightKg) < 0.001
      return isMaintain ? draft.weeklyRateKg === 0 : draft.weeklyRateKg > 0
    }
    default:
      return false
  }
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col bg-background px-6 py-6">
      {children}
    </div>
  )
}

function BackButton({
  onClick,
  disabled,
}: {
  onClick: () => void
  disabled: boolean
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      disabled={disabled}
      className={cn(disabled && "invisible")}
      aria-label="Back"
    >
      <CaretLeft className="size-5" weight="bold" />
    </Button>
  )
}

function Dots({ count, current }: { count: number; current: number }) {
  return (
    <div className="flex flex-1 items-center justify-center gap-1.5">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={cn(
            "size-2 rounded-full transition-colors",
            i + 1 <= current ? "bg-foreground" : "bg-foreground/20"
          )}
        />
      ))}
    </div>
  )
}

function StepHeading({
  title,
  subtitle,
}: {
  title: string
  subtitle?: string
}) {
  return (
    <header className="mb-6 flex flex-col gap-1.5">
      <h1 className="font-heading text-2xl font-semibold">{title}</h1>
      {subtitle && (
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      )}
    </header>
  )
}

function StepSex({
  value,
  onChange,
}: {
  value: Sex | null
  onChange: (v: Sex) => void
}) {
  return (
    <div className="flex flex-col gap-6">
      <StepHeading title="Which formula should we use?" />
      <div className="flex flex-col gap-3">
        <ChoiceChip
          label="Male"
          selected={value === "male"}
          onClick={() => onChange("male")}
        />
        <ChoiceChip
          label="Female"
          selected={value === "female"}
          onClick={() => onChange("female")}
        />
      </div>
    </div>
  )
}

function StepBirthday({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const max = useMemo(() => formatLocalDate(todayLocal()), [])
  const min = useMemo(() => {
    const d = todayLocal()
    d.setFullYear(d.getFullYear() - 110)
    return formatLocalDate(d)
  }, [])
  return (
    <div className="flex flex-col gap-6">
      <StepHeading title="When were you born?" subtitle="We use this to compute your age each time we run the formula." />
      <div className="flex flex-col gap-2">
        <Label htmlFor="birthday">Birthday</Label>
        <Input
          id="birthday"
          type="date"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  )
}

function StepHeight({
  heightCm,
  unit,
  onHeightChange,
  onUnitChange,
}: {
  heightCm: number | null
  unit: "cm" | "imperial"
  onHeightChange: (cm: number) => void
  onUnitChange: (u: "cm" | "imperial") => void
}) {
  return (
    <div className="flex flex-col gap-6">
      <StepHeading title="How tall are you?" />
      <UnitToggle
        value={unit}
        options={[
          { value: "cm", label: "cm" },
          { value: "imperial", label: "ft + in" },
        ]}
        onChange={onUnitChange}
      />
      {unit === "cm" ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="height-cm">Height (cm)</Label>
          <Input
            id="height-cm"
            type="number"
            inputMode="numeric"
            min={100}
            max={250}
            value={heightCm ?? ""}
            onChange={(e) => {
              const v = e.target.value
              if (v === "") return
              const n = Number(v)
              if (Number.isFinite(n)) onHeightChange(Math.round(n))
            }}
          />
        </div>
      ) : (
        <ImperialHeightInput
          heightCm={heightCm}
          onChange={onHeightChange}
        />
      )}
    </div>
  )
}

function ImperialHeightInput({
  heightCm,
  onChange,
}: {
  heightCm: number | null
  onChange: (cm: number) => void
}) {
  const display = heightCm != null ? cmToImperial(heightCm) : { feet: 0, inches: 0 }
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="height-ft">Feet</Label>
        <Input
          id="height-ft"
          type="number"
          inputMode="numeric"
          min={3}
          max={8}
          value={heightCm != null ? display.feet : ""}
          onChange={(e) => {
            const n = Number(e.target.value)
            if (Number.isFinite(n)) onChange(imperialToCm(n, display.inches))
          }}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="height-in">Inches</Label>
        <Input
          id="height-in"
          type="number"
          inputMode="numeric"
          min={0}
          max={11}
          value={heightCm != null ? display.inches : ""}
          onChange={(e) => {
            const n = Number(e.target.value)
            if (Number.isFinite(n)) onChange(imperialToCm(display.feet, n))
          }}
        />
      </div>
    </div>
  )
}

function StepWeight({
  weightKg,
  unit,
  onWeightChange,
  onUnitChange,
}: {
  weightKg: number | null
  unit: "kg" | "lb"
  onWeightChange: (kg: number) => void
  onUnitChange: (u: "kg" | "lb") => void
}) {
  // Local text state so typing "93.5" doesn't get round-tripped through the
  // numeric parent state, which would strip the trailing dot mid-keystroke
  // and turn "93.5" into "935".
  const [text, setText] = useState<string>(() =>
    weightKg == null
      ? ""
      : unit === "kg"
        ? String(Math.round(weightKg * 10) / 10)
        : String(Math.round(kgToLb(weightKg)))
  )
  const handleUnitChange = (u: "kg" | "lb") => {
    onUnitChange(u)
    if (weightKg != null) {
      setText(
        u === "kg"
          ? String(Math.round(weightKg * 10) / 10)
          : String(Math.round(kgToLb(weightKg)))
      )
    }
  }
  const handleTextChange = (v: string) => {
    setText(v)
    if (v === "" || v === "." || v === "-") return
    const n = Number(v)
    if (!Number.isFinite(n)) return
    onWeightChange(unit === "kg" ? n : lbToKg(n))
  }
  return (
    <div className="flex flex-col gap-6">
      <StepHeading title="What do you weigh now?" subtitle="This is your starting weight — we'll log it." />
      <UnitToggle
        value={unit}
        options={[
          { value: "kg", label: "kg" },
          { value: "lb", label: "lb" },
        ]}
        onChange={handleUnitChange}
      />
      <div className="flex flex-col gap-2">
        <Label htmlFor="weight">Weight ({unit})</Label>
        <Input
          id="weight"
          type="number"
          inputMode="decimal"
          step={unit === "kg" ? 0.1 : 1}
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
        />
      </div>
    </div>
  )
}

const ACTIVITY_OPTIONS: ReadonlyArray<{
  value: ActivityLevel
  label: string
  description: string
}> = [
  { value: "sedentary", label: "Sedentary", description: "Little or no exercise" },
  { value: "light", label: "Light", description: "Exercise 1–3 days/week" },
  { value: "moderate", label: "Moderate", description: "Exercise 3–5 days/week" },
  { value: "active", label: "Active", description: "Exercise 6–7 days/week" },
]

function StepActivity({
  value,
  onChange,
}: {
  value: ActivityLevel | null
  onChange: (v: ActivityLevel) => void
}) {
  return (
    <div className="flex flex-col gap-6">
      <StepHeading title="How active are you?" />
      <div className="flex flex-col gap-2">
        {ACTIVITY_OPTIONS.map((opt) => (
          <ChoiceChip
            key={opt.value}
            label={opt.label}
            description={opt.description}
            selected={value === opt.value}
            onClick={() => onChange(opt.value)}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Multiplier applied to your BMR: {ACTIVITY_MULTIPLIERS.sedentary}× → {ACTIVITY_MULTIPLIERS.active}×.
      </p>
    </div>
  )
}

function StepGoal({
  draft,
  onGoalWeightChange,
  onRateChange,
}: {
  draft: Draft
  onGoalWeightChange: (kg: number) => void
  onRateChange: (r: number) => void
}) {
  const current = draft.weightKg ?? 70
  // Slider operates in integer kg; the Member's actual weight may be
  // fractional (e.g. 93.5). The thumb position uses the rounded value;
  // the "Current" label below shows the real fractional value.
  const currentRounded = Math.round(current)
  const goal = draft.goalWeightKg ?? current
  // Asymmetric range: lose more than you gain, in realistic chunks.
  // Floored/capped at the schema's absolute bounds (30 / 300 kg).
  const min = Math.max(30, currentRounded - 60)
  const max = Math.min(300, currentRounded + 30)
  const isMaintain = Math.abs(goal - current) < 0.5
  const direction = goal < current ? "Lose" : goal > current ? "Gain" : "Maintain"
  const diffKg = Math.abs(goal - current)
  const currentDisplay =
    draft.displayWeightUnit === "kg"
      ? `${Math.round(current * 10) / 10} kg`
      : `${Math.round(kgToLb(current))} lb`

  const preview = useMemo(() => {
    if (
      !draft.sex ||
      !draft.birthday ||
      draft.heightCm == null ||
      draft.weightKg == null ||
      !draft.activityLevel ||
      draft.goalWeightKg == null
    ) {
      return null
    }
    return deriveProfile({
      sex: draft.sex,
      birthday: draft.birthday,
      heightCm: draft.heightCm,
      weightKg: draft.weightKg,
      activityLevel: draft.activityLevel,
      goalWeightKg: draft.goalWeightKg,
      weeklyRateKg: draft.weeklyRateKg,
    })
  }, [
    draft.sex,
    draft.birthday,
    draft.heightCm,
    draft.weightKg,
    draft.activityLevel,
    draft.goalWeightKg,
    draft.weeklyRateKg,
  ])

  const etaWeeks =
    !isMaintain && draft.weeklyRateKg > 0 ? diffKg / draft.weeklyRateKg : null

  return (
    <div className="flex flex-col gap-6">
      <StepHeading title="Your goal" subtitle="Pick a goal weight. Slide to current to maintain." />

      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium">{direction}</span>
          <span className="text-2xl font-semibold tabular-nums">
            {goal} kg
          </span>
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={Math.round(goal)}
          onChange={(e) => onGoalWeightChange(Number(e.target.value))}
          className="w-full"
          aria-label="Goal weight"
        />
        <div className="flex justify-between text-[10px] tabular-nums text-muted-foreground">
          <span>{min} kg</span>
          <span>Current: {currentDisplay}</span>
          <span>{max} kg</span>
        </div>
      </div>

      {!isMaintain && (
        <div className="flex flex-col gap-2">
          <Label>How fast?</Label>
          <div className="grid grid-cols-2 gap-2">
            <RateChip
              label="Slowly"
              sub="~0.25 kg/wk"
              selected={draft.weeklyRateKg === 0.25}
              onClick={() => onRateChange(0.25)}
            />
            <RateChip
              label="Moderately"
              sub="~0.5 kg/wk"
              selected={draft.weeklyRateKg === 0.5}
              onClick={() => onRateChange(0.5)}
            />
          </div>
        </div>
      )}

      {preview && (
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Daily target
          </p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">
            {preview.targetKcal}
            <span className="ms-1 text-sm font-normal text-muted-foreground">
              kcal
            </span>
          </p>
          {etaWeeks != null && (
            <p className="mt-2 text-xs text-muted-foreground">
              At this rate, ~{Math.round(etaWeeks)} weeks to reach your goal.
            </p>
          )}
          <p className="mt-3 text-xs tabular-nums text-muted-foreground">
            P {preview.macros.proteinG}g · C {preview.macros.carbsG}g · F{" "}
            {preview.macros.fatG}g
          </p>
        </div>
      )}
    </div>
  )
}

function ChoiceChip({
  label,
  description,
  selected,
  onClick,
}: {
  label: string
  description?: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex flex-col items-start gap-0.5 rounded-xl border px-4 py-3 text-start transition-colors",
        selected
          ? "border-foreground bg-foreground/5"
          : "border-foreground/15 hover:border-foreground/30"
      )}
    >
      <span className="font-medium">{label}</span>
      {description && (
        <span className="text-xs text-muted-foreground">{description}</span>
      )}
    </button>
  )
}

function RateChip({
  label,
  sub,
  selected,
  onClick,
}: {
  label: string
  sub: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-start transition-colors",
        selected
          ? "border-foreground bg-foreground/5"
          : "border-foreground/15 hover:border-foreground/30"
      )}
    >
      <span className="text-sm font-medium">{label}</span>
      <span className="text-[10px] text-muted-foreground">{sub}</span>
    </button>
  )
}

function UnitToggle<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="inline-flex self-start rounded-full bg-muted p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium transition-colors",
            value === o.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

