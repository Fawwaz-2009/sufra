import { useMemo, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { tomorrowLocalDate } from "@/lib/date"
import { cn } from "@/lib/utils"
import { kgToLb, lbToKg } from "@/lib/units"
import { deriveProfile } from "../../worker/profile/isomorphic/derive"
import type { ProfileSnapshot } from "../../worker/profile/schema"

// Shared Log Weight sheet — rendered from both Profile and Progress. Posts to
// /api/weights, which atomically writes a `weight_log` row (the measurement
// the Progress chart reads) and a `profile_log` row with
// effective_from = tomorrow (the plan that drives Target derivation from
// tomorrow onward; today stays sealed per ADR 0002).
//
// Per ADR 0007, this is the canonical write surface for Weights. The toast
// is intentionally terse ("Logged") — the "Target updates tomorrow" rule
// lives in /how-it-works rather than firing on every weigh-in.

export function LogWeightSheet({
  open,
  onOpenChange,
  profile,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  profile: ProfileSnapshot
}) {
  const [unit, setUnit] = useState<"kg" | "lb">(profile.displayWeightUnit)
  const [kg, setKg] = useState(profile.weightKg)
  // Local text state so typing "93." doesn't lose the trailing dot when the
  // parent coerces to number mid-keystroke. Same pattern as StepWeight.
  const [text, setText] = useState<string>(() =>
    profile.displayWeightUnit === "kg"
      ? String(Math.round(profile.weightKg * 10) / 10)
      : String(Math.round(kgToLb(profile.weightKg)))
  )
  const auth = useAuth()
  const queryClient = useQueryClient()
  const previousTarget = useMemo(() => deriveProfile(profile).targetKcal, [profile])

  const mutation = useMutation({
    mutationFn: async (vars: { weightKg: number; unit: "kg" | "lb" }) => {
      const res = await api.api.weights.$post({
        json: {
          weightKg: vars.weightKg,
          displayWeightUnit: vars.unit,
          effectiveFrom: tomorrowLocalDate(),
        },
      })
      if (!res.ok) throw new Error("log_failed")
      return res.json()
    },
    onSuccess: async () => {
      await auth.refresh()
      await queryClient.invalidateQueries({ queryKey: ["weights"] })
      await queryClient.invalidateQueries({ queryKey: ["calorie-history"] })
      toast.success("Logged")
      onOpenChange(false)
    },
    onError: () => {
      toast.error("Couldn't log that. Try again.")
    },
  })

  const valid = kg >= 30 && kg <= 300

  const handleUnitChange = (u: "kg" | "lb") => {
    setUnit(u)
    setText(
      u === "kg"
        ? String(Math.round(kg * 10) / 10)
        : String(Math.round(kgToLb(kg)))
    )
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
      <SheetContent>
        <SheetTitle>Log weight</SheetTitle>
        <div className="mt-4 flex flex-col gap-4">
          <div className="inline-flex self-start rounded-full bg-muted p-1">
            {(["kg", "lb"] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => handleUnitChange(u)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  unit === u
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground"
                )}
              >
                {u}
              </button>
            ))}
          </div>
          <Input
            type="number"
            inputMode="decimal"
            step={unit === "kg" ? 0.1 : 1}
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
          />
          <DerivedPreview profile={profile} draftKg={kg} previous={previousTarget} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <SheetClose render={<Button variant="outline" />}>Cancel</SheetClose>
          <Button
            onClick={() => mutation.mutate({ weightKg: kg, unit })}
            disabled={!valid || mutation.isPending}
          >
            {mutation.isPending ? "Logging…" : "Log weight"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function DerivedPreview({
  profile,
  draftKg,
  previous,
}: {
  profile: ProfileSnapshot
  draftKg: number
  previous: number
}) {
  const derived = deriveProfile({ ...profile, weightKg: draftKg })
  const changed = derived.targetKcal !== previous
  return (
    <div className="rounded-md bg-foreground/5 p-3 text-sm">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        Tomorrow&apos;s daily target
      </p>
      <p className="mt-0.5 text-2xl font-semibold tabular-nums">
        {derived.targetKcal}
        <span className="ms-1 text-xs font-normal text-muted-foreground">kcal</span>
        {changed && (
          <span className="ms-2 text-xs font-normal text-muted-foreground">
            was {previous}
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
