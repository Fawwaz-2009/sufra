import { useMemo, useState, type ReactNode } from "react"
import { Info } from "lucide-react"
import { Link } from "@tanstack/react-router"

import { cn } from "@/lib/utils"
import type { MealListItemView } from "@/worker/views/meal"
import { deriveProfile } from "@/worker/views/derive"
import type { ProfileSnapshotView as ProfileSnapshot } from "@/worker/views/profile-snapshot"

type Mode = "remaining" | "consumed"
const LS_KEY = "sufra:ring-mode"

// Day Summary panel: kcal ring + 3 macro bars. Compute is client-side from
// the (already-fetched) meals list for the selected day and the active
// profile snapshot for that day. See ADRs 0002 (past days are stable) and
// 0003 (totals derived at read time, not stored).
export function DaySummaryPanel({
  meals,
  profile,
}: {
  meals: MealListItemView[]
  profile: ProfileSnapshot
}) {
  const [mode, setMode] = useRingMode()

  const derived = useMemo(() => deriveProfile(profile), [profile])
  const eaten = useMemo(() => {
    let kcal = 0,
      p = 0,
      c = 0,
      f = 0
    for (const m of meals) {
      // A meal whose estimate hasn't succeeded yet has no totals (ADR 0017) — it counts as nothing.
      if (m.totals === null) continue
      kcal += m.totals.kcal
      p += m.totals.proteinG
      c += m.totals.carbsG
      f += m.totals.fatG
    }
    return {
      kcal: Math.round(kcal),
      proteinG: Math.round(p),
      carbsG: Math.round(c),
      fatG: Math.round(f),
    }
  }, [meals])

  const target = derived.targetKcal
  const remaining = target - eaten.kcal
  const pct = target > 0 ? eaten.kcal / target : 0
  const status: "ok" | "warn" | "over" =
    pct <= 1 ? "ok" : pct <= 1.15 ? "warn" : "over"

  const ringValue = mode === "remaining" ? remaining : eaten.kcal
  const ringLabel = mode === "remaining"
    ? remaining >= 0
      ? "Remaining"
      : "Over"
    : "Consumed"

  return (
    <section className="px-5">
      <div className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() =>
              setMode(mode === "remaining" ? "consumed" : "remaining")
            }
            aria-label={`Switch to ${mode === "remaining" ? "consumed" : "remaining"}`}
            className="shrink-0 outline-none"
          >
            <Ring percent={pct} status={status}>
              <span className="text-2xl font-semibold tabular-nums">
                {Math.abs(Math.round(ringValue))}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {ringLabel}
              </span>
              <span className="mt-0.5 text-[9px] text-muted-foreground/70">
                tap to toggle
              </span>
            </Ring>
          </button>

          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <MacroBar
              label="Protein"
              eaten={eaten.proteinG}
              goal={derived.macros.proteinG}
            />
            <MacroBar
              label="Carbs"
              eaten={eaten.carbsG}
              goal={derived.macros.carbsG}
            />
            <MacroBar
              label="Fat"
              eaten={eaten.fatG}
              goal={derived.macros.fatG}
            />
          </div>
        </div>

        <Link
          to="/how-it-works"
          aria-label="How does this work?"
          className="mt-3 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <Info className="size-3.5" /> How does this work?
        </Link>
      </div>
    </section>
  )
}

function Ring({
  percent,
  status,
  children,
}: {
  percent: number
  status: "ok" | "warn" | "over"
  children: ReactNode
}) {
  const size = 120
  const stroke = 10
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  // Cap visual fill at 100% — the inner number tells the actual story when
  // the Member is past their target.
  const filled = Math.min(1, Math.max(0, percent))
  const offset = c * (1 - filled)
  const strokeClass =
    status === "ok"
      ? "stroke-primary"
      : status === "warn"
        ? "stroke-amber-500"
        : "stroke-destructive"

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-foreground/10"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className={cn("transition-all duration-500", strokeClass)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  )
}

function MacroBar({
  label,
  eaten,
  goal,
}: {
  label: string
  eaten: number
  goal: number
}) {
  const pct = goal > 0 ? Math.min(1, eaten / goal) : 0
  const over = goal > 0 && eaten > goal
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between text-xs tabular-nums">
        <span className="text-muted-foreground">{label}</span>
        <span>
          <span className={cn(over && "text-destructive")}>{eaten}</span>
          <span className="text-muted-foreground">/{goal}g</span>
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
        <div
          className={cn(
            "h-full transition-all duration-500",
            over ? "bg-destructive" : "bg-foreground/60"
          )}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  )
}

function useRingMode(): [Mode, (m: Mode) => void] {
  const [mode, setMode] = useState<Mode>(() => {
    if (typeof window === "undefined") return "remaining"
    const v = window.localStorage.getItem(LS_KEY)
    return v === "consumed" ? "consumed" : "remaining"
  })
  const update = (m: Mode) => {
    setMode(m)
    try {
      window.localStorage.setItem(LS_KEY, m)
    } catch {
      // localStorage can throw in private-mode Safari; the in-memory state
      // still updates so the toggle works for this session.
    }
  }
  return [mode, update]
}
