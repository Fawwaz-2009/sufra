import { useState } from "react"
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/setup")({
  beforeLoad: ({ context }) => {
    if (!context.needsSetup) {
      throw redirect({ to: context.session ? "/" : "/login" })
    }
  },
  component: SetupWizard,
})

function SetupWizard() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState<1 | 2>(1)
  const [familyName, setFamilyName] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const trimmedFamily = familyName.trim()
  const canContinueStep1 = trimmedFamily.length > 0 && trimmedFamily.length <= 40

  const validateStep2 = (): string | null => {
    if (username.length < 3) return "Username must be at least 3 characters."
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return "Username: letters, numbers, underscore only."
    }
    if (password.length < 6) return "Password must be at least 6 characters."
    if (password !== confirm) return "Passwords don't match."
    return null
  }

  const submit = async () => {
    const err = validateStep2()
    if (err) {
      setSubmitError(err)
      return
    }
    setSubmitError(null)
    setIsSubmitting(true)
    try {
      const res = await api.api.setup.$post({
        json: { familyName: trimmedFamily, username, password },
      })
      if (!res.ok) {
        // Surface the actual server error code so a stale second submission
        // (already_set_up) is recognizable instead of the vague catch-all.
        const body = (await res
          .json()
          .catch(() => ({ error: "unknown" }))) as { error?: string }
        setSubmitError(`Error: ${body.error ?? `HTTP ${res.status}`}`)
        return
      }
      await auth.refresh()
      // Refreshing the auth context updates `needsSetup` and `session`, but
      // TSR doesn't re-fire beforeLoad on context mutation. Navigate
      // explicitly — the root onboarding gate then routes a brand-new host
      // to /onboarding (no profile_log row yet).
      void navigate({ to: "/" })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Shell>
      <Dots step={step} />
      {step === 1 ? (
        <StepFamilyName
          familyName={familyName}
          setFamilyName={setFamilyName}
          canContinue={canContinueStep1}
          onContinue={() => setStep(2)}
        />
      ) : (
        <StepAccount
          familyName={trimmedFamily}
          username={username}
          setUsername={setUsername}
          password={password}
          setPassword={setPassword}
          confirm={confirm}
          setConfirm={setConfirm}
          submitError={submitError}
          isSubmitting={isSubmitting}
          onBack={() => {
            setSubmitError(null)
            setStep(1)
          }}
          onSubmit={submit}
        />
      )}
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background px-6 py-10">
      <div className="w-full max-w-md">{children}</div>
    </div>
  )
}

function Dots({ step }: { step: 1 | 2 }) {
  return (
    <div className="mb-8 flex items-center gap-1.5">
      <Dot active />
      <Dot active={step === 2} />
    </div>
  )
}

function Dot({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "size-2 rounded-full transition-colors",
        active ? "bg-foreground" : "bg-foreground/20"
      )}
    />
  )
}

function StepFamilyName({
  familyName,
  setFamilyName,
  canContinue,
  onContinue,
}: {
  familyName: string
  setFamilyName: (s: string) => void
  canContinue: boolean
  onContinue: () => void
}) {
  const trimmed = familyName.trim()
  const previewName = trimmed.length > 0 ? trimmed : "…"
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <h1 className="font-heading text-2xl font-semibold">
          Welcome to Sufra
        </h1>
        <p className="text-sm text-muted-foreground">
          Sufra is the Arabic word for the dining table — more than the
          furniture, it's the spread of food and the people gathered around it.
          Sufra exists to help you stay at yours.
        </p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (canContinue) onContinue()
        }}
        className="flex flex-col gap-3"
      >
        <div className="grid gap-2">
          <Label htmlFor="family-name">What do you call your sufra?</Label>
          <Input
            id="family-name"
            autoFocus
            maxLength={40}
            placeholder="Your family name"
            value={familyName}
            onChange={(e) => setFamilyName(e.target.value)}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Your Sufra will be called{" "}
          <span className="text-foreground">the {previewName} Sufra</span>
        </p>
        <Button type="submit" disabled={!canContinue} className="mt-2">
          Continue →
        </Button>
      </form>
    </div>
  )
}

function StepAccount({
  familyName,
  username,
  setUsername,
  password,
  setPassword,
  confirm,
  setConfirm,
  submitError,
  isSubmitting,
  onBack,
  onSubmit,
}: {
  familyName: string
  username: string
  setUsername: (s: string) => void
  password: string
  setPassword: (s: string) => void
  confirm: string
  setConfirm: (s: string) => void
  submitError: string | null
  isSubmitting: boolean
  onBack: () => void
  onSubmit: () => void
}) {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <h1 className="font-heading text-2xl font-semibold">
          Create your account
        </h1>
        <p className="text-sm text-muted-foreground">
          You're the Host. You manage the {familyName} Sufra and invite the
          people who'll join you at it.
        </p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit()
        }}
        className="flex flex-col gap-4"
      >
        <div className="grid gap-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            autoComplete="username"
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="password">Password (6+ characters)</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>

        {submitError && (
          <p className="text-xs text-destructive">{submitError}</p>
        )}

        <Button type="submit" disabled={isSubmitting} className="mt-2">
          {isSubmitting ? "Creating…" : `Create the ${familyName} Sufra →`}
        </Button>
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← Back
        </button>
      </form>
    </div>
  )
}
