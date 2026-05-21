import { useMemo, useState, type ReactNode } from "react"
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router"
import { CaretRight, Info } from "@phosphor-icons/react"
import { toast } from "sonner"

import { BottomNav } from "@/components/bottom-nav"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { tomorrowLocalDate } from "@/lib/date"
import { cmToImperial, imperialToCm, kgToLb, lbToKg } from "@/lib/units"
import { cn } from "@/lib/utils"
import type {
  ActivityLevel,
  Sex,
} from "../../worker/profile/isomorphic/constants"
import {
  ageFromBirthday,
  deriveProfile,
} from "../../worker/profile/isomorphic/derive"
import type { ProfileSnapshot } from "../../worker/profile/schema"

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

// ---- Sections ----------------------------------------------------------

function AboutYouSection({ profile }: { profile: ProfileSnapshot }) {
  const [open, setOpen] = useState<null | "sex" | "birthday" | "height" | "weight" | "activity">(null)
  const ageYears = ageFromBirthday(profile.birthday)
  return (
    <SectionCard label="About you">
      <Row
        label="Sex"
        value={profile.sex === "male" ? "Male" : "Female"}
        onClick={() => setOpen("sex")}
      />
      <Row
        label="Birthday"
        value={`${profile.birthday} · ${ageYears} yr`}
        onClick={() => setOpen("birthday")}
      />
      <Row
        label="Height"
        value={formatHeight(profile.heightCm, profile.displayHeightUnit)}
        onClick={() => setOpen("height")}
      />
      <Row
        label="Weight"
        value={formatWeight(profile.weightKg, profile.displayWeightUnit)}
        onClick={() => setOpen("weight")}
      />
      <Row
        label="Activity"
        value={ACTIVITY_LABELS[profile.activityLevel]}
        onClick={() => setOpen("activity")}
      />

      <SexSheet
        open={open === "sex"}
        onOpenChange={(v) => setOpen(v ? "sex" : null)}
        profile={profile}
      />
      <BirthdaySheet
        open={open === "birthday"}
        onOpenChange={(v) => setOpen(v ? "birthday" : null)}
        profile={profile}
      />
      <HeightSheet
        open={open === "height"}
        onOpenChange={(v) => setOpen(v ? "height" : null)}
        profile={profile}
      />
      <WeightSheet
        open={open === "weight"}
        onOpenChange={(v) => setOpen(v ? "weight" : null)}
        profile={profile}
      />
      <ActivitySheet
        open={open === "activity"}
        onOpenChange={(v) => setOpen(v ? "activity" : null)}
        profile={profile}
      />
    </SectionCard>
  )
}

function GoalSection({ profile }: { profile: ProfileSnapshot }) {
  const [open, setOpen] = useState(false)
  const direction =
    profile.goalWeightKg < profile.weightKg
      ? "Lose"
      : profile.goalWeightKg > profile.weightKg
        ? "Gain"
        : "Maintain"
  const sub =
    direction === "Maintain"
      ? "Holding current weight"
      : `${direction} to ${profile.goalWeightKg} kg · ~${profile.weeklyRateKg} kg/wk`
  return (
    <SectionCard label="Goal">
      <Row label={direction} value={sub} onClick={() => setOpen(true)} />
      <GoalSheet open={open} onOpenChange={setOpen} profile={profile} />
    </SectionCard>
  )
}

function YourNumbersSection({
  targetKcal,
  macros,
  hasPending,
}: {
  targetKcal: number
  macros: { proteinG: number; carbsG: number; fatG: number }
  hasPending: boolean
}) {
  return (
    <SectionCard label="Your numbers">
      <div className="flex flex-col gap-3 px-4 py-3">
        {hasPending && (
          <p className="rounded-md bg-foreground/5 px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            Pending changes — starts tomorrow
          </p>
        )}
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">Daily target</span>
          <span className="text-2xl font-semibold tabular-nums">
            {targetKcal}
            <span className="ms-1 text-xs font-normal text-muted-foreground">
              kcal
            </span>
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-xs tabular-nums">
          <MacroCell label="Protein" g={macros.proteinG} />
          <MacroCell label="Carbs" g={macros.carbsG} />
          <MacroCell label="Fat" g={macros.fatG} />
        </div>
        <Link
          to="/how-it-works"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Info className="size-3.5" /> How does this work?
        </Link>
      </div>
    </SectionCard>
  )
}

function MacroCell({ label, g }: { label: string; g: number }) {
  return (
    <div className="rounded-md bg-foreground/5 px-2 py-2">
      <p className="text-muted-foreground">{label}</p>
      <p className="text-base font-medium">{g}g</p>
    </div>
  )
}

function AccountSection({ username }: { username: string }) {
  const auth = useAuth()
  const navigate = useNavigate()
  const handleSignOut = async () => {
    await auth.signOut()
    void navigate({ to: "/login" })
  }
  return (
    <SectionCard label="Account">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-sm text-muted-foreground">Username</span>
        <span className="text-sm">{username}</span>
      </div>
      <div className="px-4 py-3">
        <Button variant="outline" onClick={handleSignOut} className="w-full">
          Sign out
        </Button>
      </div>
    </SectionCard>
  )
}

// ---- Layout primitives -------------------------------------------------

function SectionCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section>
      <p className="mb-2 text-xs font-medium tracking-wider text-muted-foreground uppercase">
        {label}
      </p>
      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 divide-y divide-foreground/5">
        {children}
      </div>
    </section>
  )
}

function Row({
  label,
  value,
  onClick,
}: {
  label: string
  value: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start hover:bg-foreground/[0.02]"
    >
      <span className="text-sm font-medium">{label}</span>
      <span className="flex items-center gap-1 text-sm text-muted-foreground">
        {value}
        <CaretRight className="size-3.5" weight="bold" />
      </span>
    </button>
  )
}

// ---- Sheets ------------------------------------------------------------

type FieldSheetProps = {
  open: boolean
  onOpenChange: (v: boolean) => void
  profile: ProfileSnapshot
}

function SheetShell({
  title,
  children,
  onSave,
  saving,
  disabled,
}: {
  title: string
  children: ReactNode
  onSave: () => void
  saving: boolean
  disabled: boolean
}) {
  return (
    <SheetContent>
      <SheetTitle>{title}</SheetTitle>
      <div className="mt-4 flex flex-col gap-4">{children}</div>
      <p className="mt-4 rounded-md bg-foreground/5 px-3 py-2 text-xs text-muted-foreground">
        Starts tomorrow at midnight (your local time).
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <SheetClose render={<Button variant="outline" />}>Cancel</SheetClose>
        <Button onClick={onSave} disabled={disabled || saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </SheetContent>
  )
}

function useProfilePatch() {
  const auth = useAuth()
  const [saving, setSaving] = useState(false)

  const save = async (patch: Record<string, unknown>) => {
    setSaving(true)
    try {
      const res = await api.api.profile.$patch({
        json: {
          ...patch,
          effectiveFrom: tomorrowLocalDate(),
        } as Parameters<typeof api.api.profile.$patch>[0]["json"],
      })
      if (!res.ok) {
        toast.error("Couldn't save. Try again.")
        return false
      }
      await auth.refresh()
      toast.success("Saved — starts tomorrow.")
      return true
    } finally {
      setSaving(false)
    }
  }

  return { save, saving }
}

function PreviewBox({
  inputs,
  previousTarget,
}: {
  inputs: Parameters<typeof deriveProfile>[0]
  previousTarget: number
}) {
  const derived = deriveProfile(inputs)
  const changed = derived.targetKcal !== previousTarget
  return (
    <div className="rounded-md bg-foreground/5 p-3 text-sm">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        Daily target
      </p>
      <p className="mt-0.5 text-2xl font-semibold tabular-nums">
        {derived.targetKcal}
        <span className="ms-1 text-xs font-normal text-muted-foreground">
          kcal
        </span>
        {changed && (
          <span className="ms-2 text-xs font-normal text-muted-foreground">
            was {previousTarget}
          </span>
        )}
      </p>
      <p className="mt-1 text-xs tabular-nums text-muted-foreground">
        P {derived.macros.proteinG}g · C {derived.macros.carbsG}g · F{" "}
        {derived.macros.fatG}g
      </p>
    </div>
  )
}

function SexSheet({ open, onOpenChange, profile }: FieldSheetProps) {
  const [value, setValue] = useState<Sex>(profile.sex)
  const { save, saving } = useProfilePatch()
  const previous = useMemo(() => deriveProfile(profile).targetKcal, [profile])
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetShell
        title="Which formula should we use?"
        onSave={async () => {
          if (await save({ sex: value })) onOpenChange(false)
        }}
        saving={saving}
        disabled={value === profile.sex}
      >
        <div className="grid grid-cols-2 gap-2">
          <ChipButton
            label="Male"
            selected={value === "male"}
            onClick={() => setValue("male")}
          />
          <ChipButton
            label="Female"
            selected={value === "female"}
            onClick={() => setValue("female")}
          />
        </div>
        <PreviewBox inputs={{ ...profile, sex: value }} previousTarget={previous} />
      </SheetShell>
    </Sheet>
  )
}

function BirthdaySheet({ open, onOpenChange, profile }: FieldSheetProps) {
  const [value, setValue] = useState(profile.birthday)
  const { save, saving } = useProfilePatch()
  const previous = useMemo(() => deriveProfile(profile).targetKcal, [profile])
  const isoValid = /^\d{4}-\d{2}-\d{2}$/.test(value)
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetShell
        title="Your birthday"
        onSave={async () => {
          if (await save({ birthday: value })) onOpenChange(false)
        }}
        saving={saving}
        disabled={!isoValid || value === profile.birthday}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="bd">Birthday</Label>
          <Input
            id="bd"
            type="date"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        {isoValid && (
          <PreviewBox
            inputs={{ ...profile, birthday: value }}
            previousTarget={previous}
          />
        )}
      </SheetShell>
    </Sheet>
  )
}

function HeightSheet({ open, onOpenChange, profile }: FieldSheetProps) {
  const [unit, setUnit] = useState<"cm" | "imperial">(profile.displayHeightUnit)
  const [cm, setCm] = useState(profile.heightCm)
  const { save, saving } = useProfilePatch()
  const previous = useMemo(() => deriveProfile(profile).targetKcal, [profile])
  const valid = cm >= 100 && cm <= 250
  const changed =
    cm !== profile.heightCm || unit !== profile.displayHeightUnit
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetShell
        title="Height"
        onSave={async () => {
          if (
            await save({ heightCm: cm, displayHeightUnit: unit })
          )
            onOpenChange(false)
        }}
        saving={saving}
        disabled={!valid || !changed}
      >
        <UnitToggle
          value={unit}
          options={[
            { value: "cm", label: "cm" },
            { value: "imperial", label: "ft + in" },
          ]}
          onChange={setUnit}
        />
        {unit === "cm" ? (
          <Input
            type="number"
            inputMode="numeric"
            value={cm}
            min={100}
            max={250}
            onChange={(e) => {
              const n = Number(e.target.value)
              if (Number.isFinite(n)) setCm(Math.round(n))
            }}
          />
        ) : (
          (() => {
            const { feet, inches } = cmToImperial(cm)
            return (
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  value={feet}
                  min={3}
                  max={8}
                  onChange={(e) => {
                    const n = Number(e.target.value)
                    if (Number.isFinite(n)) setCm(imperialToCm(n, inches))
                  }}
                />
                <Input
                  type="number"
                  value={inches}
                  min={0}
                  max={11}
                  onChange={(e) => {
                    const n = Number(e.target.value)
                    if (Number.isFinite(n)) setCm(imperialToCm(feet, n))
                  }}
                />
              </div>
            )
          })()
        )}
        <PreviewBox inputs={{ ...profile, heightCm: cm }} previousTarget={previous} />
      </SheetShell>
    </Sheet>
  )
}

function WeightSheet({ open, onOpenChange, profile }: FieldSheetProps) {
  const [unit, setUnit] = useState<"kg" | "lb">(profile.displayWeightUnit)
  const [kg, setKg] = useState(profile.weightKg)
  // Mirror StepWeight's pattern — keep the input text as local string state
  // so typing "93.5" doesn't get its trailing dot stripped mid-keystroke.
  const [text, setText] = useState<string>(() =>
    profile.displayWeightUnit === "kg"
      ? String(Math.round(profile.weightKg * 10) / 10)
      : String(Math.round(kgToLb(profile.weightKg)))
  )
  const { save, saving } = useProfilePatch()
  const previous = useMemo(() => deriveProfile(profile).targetKcal, [profile])
  const valid = kg >= 30 && kg <= 300
  const changed = kg !== profile.weightKg || unit !== profile.displayWeightUnit
  const handleUnitChange = (u: "kg" | "lb") => {
    setUnit(u)
    setText(u === "kg" ? String(Math.round(kg * 10) / 10) : String(Math.round(kgToLb(kg))))
  }
  const handleTextChange = (v: string) => {
    setText(v)
    if (v === "" || v === "." || v === "-") return
    const n = Number(v)
    if (!Number.isFinite(n)) return
    setKg(unit === "kg" ? n : lbToKg(n))
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetShell
        title="Weight"
        onSave={async () => {
          if (await save({ weightKg: kg, displayWeightUnit: unit }))
            onOpenChange(false)
        }}
        saving={saving}
        disabled={!valid || !changed}
      >
        <UnitToggle
          value={unit}
          options={[
            { value: "kg", label: "kg" },
            { value: "lb", label: "lb" },
          ]}
          onChange={handleUnitChange}
        />
        <Input
          type="number"
          inputMode="decimal"
          step={unit === "kg" ? 0.1 : 1}
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
        />
        <PreviewBox inputs={{ ...profile, weightKg: kg }} previousTarget={previous} />
        <p className="text-xs text-muted-foreground">
          Saving here also logs a new weight entry.
        </p>
      </SheetShell>
    </Sheet>
  )
}

const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: "Sedentary",
  light: "Light",
  moderate: "Moderate",
  active: "Active",
}

const ACTIVITY_DESCRIPTIONS: Record<ActivityLevel, string> = {
  sedentary: "Little or no exercise",
  light: "Exercise 1–3 days/week",
  moderate: "Exercise 3–5 days/week",
  active: "Exercise 6–7 days/week",
}

function ActivitySheet({ open, onOpenChange, profile }: FieldSheetProps) {
  const [value, setValue] = useState<ActivityLevel>(profile.activityLevel)
  const { save, saving } = useProfilePatch()
  const previous = useMemo(() => deriveProfile(profile).targetKcal, [profile])
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetShell
        title="Activity level"
        onSave={async () => {
          if (await save({ activityLevel: value })) onOpenChange(false)
        }}
        saving={saving}
        disabled={value === profile.activityLevel}
      >
        <div className="flex flex-col gap-2">
          {(["sedentary", "light", "moderate", "active"] as const).map((v) => (
            <ChipButton
              key={v}
              label={ACTIVITY_LABELS[v]}
              description={ACTIVITY_DESCRIPTIONS[v]}
              selected={value === v}
              onClick={() => setValue(v)}
            />
          ))}
        </div>
        <PreviewBox
          inputs={{ ...profile, activityLevel: value }}
          previousTarget={previous}
        />
      </SheetShell>
    </Sheet>
  )
}

function GoalSheet({ open, onOpenChange, profile }: FieldSheetProps) {
  const [goalKg, setGoalKg] = useState(profile.goalWeightKg)
  const [rate, setRate] = useState(profile.weeklyRateKg)
  const { save, saving } = useProfilePatch()
  const previous = useMemo(() => deriveProfile(profile).targetKcal, [profile])
  // Integer-kg slider; fractional weights round for thumb position. Display
  // below the track shows the real value with one decimal precision.
  // Range asymmetric: lose up to 60 kg, gain up to 30 — wide enough for
  // realistic goals at any starting weight, bounded by schema's 30–300.
  const currentRounded = Math.round(profile.weightKg)
  const min = Math.max(30, currentRounded - 60)
  const max = Math.min(300, currentRounded + 30)
  const isMaintain = Math.abs(goalKg - profile.weightKg) < 0.5
  const effectiveRate = isMaintain ? 0 : rate
  const direction =
    goalKg < profile.weightKg
      ? "Lose"
      : goalKg > profile.weightKg
        ? "Gain"
        : "Maintain"
  const currentDisplay =
    profile.displayWeightUnit === "kg"
      ? `${Math.round(profile.weightKg * 10) / 10} kg`
      : `${Math.round(kgToLb(profile.weightKg))} lb`
  const valid = isMaintain || rate > 0
  const changed =
    goalKg !== profile.goalWeightKg || effectiveRate !== profile.weeklyRateKg
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetShell
        title="Your goal"
        onSave={async () => {
          if (
            await save({
              goalWeightKg: goalKg,
              weeklyRateKg: effectiveRate,
            })
          )
            onOpenChange(false)
        }}
        saving={saving}
        disabled={!valid || !changed}
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium">{direction}</span>
            <span className="text-2xl font-semibold tabular-nums">
              {goalKg} kg
            </span>
          </div>
          <input
            type="range"
            min={min}
            max={max}
            step={1}
            value={Math.round(goalKg)}
            onChange={(e) => setGoalKg(Number(e.target.value))}
            className="w-full"
            aria-label="Goal weight"
          />
          <div className="flex justify-between text-[10px] tabular-nums text-muted-foreground">
            <span>{min} kg</span>
            <span>Now: {currentDisplay}</span>
            <span>{max} kg</span>
          </div>
        </div>

        {!isMaintain && (
          <div className="flex flex-col gap-2">
            <Label>How fast?</Label>
            <div className="grid grid-cols-2 gap-2">
              <ChipButton
                label="Slowly"
                description="~0.25 kg/wk"
                selected={rate === 0.25}
                onClick={() => setRate(0.25)}
              />
              <ChipButton
                label="Moderately"
                description="~0.5 kg/wk"
                selected={rate === 0.5}
                onClick={() => setRate(0.5)}
              />
            </div>
          </div>
        )}

        <PreviewBox
          inputs={{
            ...profile,
            goalWeightKg: goalKg,
            weeklyRateKg: effectiveRate,
          }}
          previousTarget={previous}
        />
      </SheetShell>
    </Sheet>
  )
}

// ---- Tiny shared atoms -------------------------------------------------

function ChipButton({
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
        "flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-start transition-colors",
        selected
          ? "border-foreground bg-foreground/5"
          : "border-foreground/15"
      )}
    >
      <span className="text-sm font-medium">{label}</span>
      {description && (
        <span className="text-[10px] text-muted-foreground">{description}</span>
      )}
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

function formatHeight(cm: number, unit: "cm" | "imperial"): string {
  if (unit === "cm") return `${cm} cm`
  const { feet, inches } = cmToImperial(cm)
  return `${feet}'${inches}"`
}

function formatWeight(kg: number, unit: "kg" | "lb"): string {
  if (unit === "kg") return `${Math.round(kg * 10) / 10} kg`
  return `${Math.round(kgToLb(kg))} lb`
}
