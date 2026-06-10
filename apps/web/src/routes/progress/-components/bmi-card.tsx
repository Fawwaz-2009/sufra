import { useMemo } from "react"

import { cn } from "@/lib/utils"
import { formatHeight, formatWeight } from "@/lib/units"
import type { ProfileSnapshotView as ProfileSnapshot } from "@/worker/views/profile-snapshot"

// Universal WHO BMI bands. Bands are NOT sex-specific; height shifts only
// the kg-axis labels under the bar (not the band breakpoints themselves).
const BANDS = [
  { key: "Under", lo: 0, hi: 18.5, label: "Underweight" },
  { key: "Normal", lo: 18.5, hi: 25, label: "Normal weight" },
  { key: "Over", lo: 25, hi: 30, label: "Overweight" },
  { key: "Obese", lo: 30, hi: 60, label: "Obesity" },
] as const

// The visual scale runs from "Underweight upper end - 5kg" to "Obesity start + 10kg"
// so the bar always has some context on either side of the Normal band.
const DISPLAY_BMI_MIN = 15
const DISPLAY_BMI_MAX = 35

export function BmiCard({ profile }: { profile: ProfileSnapshot }) {
  const { heightCm, weightKg } = profile
  const bmi = useMemo(() => {
    const m = heightCm / 100
    return weightKg / (m * m)
  }, [heightCm, weightKg])
  const band = BANDS.find((b) => bmi >= b.lo && bmi < b.hi) ?? BANDS[BANDS.length - 1]!

  const m = heightCm / 100
  const kgForBmi = (b: number) => b * m * m
  const pctForBmi = (b: number) =>
    Math.min(
      100,
      Math.max(0, ((b - DISPLAY_BMI_MIN) / (DISPLAY_BMI_MAX - DISPLAY_BMI_MIN)) * 100)
    )

  return (
    <section className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="mb-3 flex items-start justify-between">
        <h2 className="font-heading text-base font-semibold">BMI</h2>
        <p className="text-xs text-muted-foreground tabular-nums">
          {formatHeight(heightCm, profile.displayHeightUnit)} ·{" "}
          {formatWeight(weightKg, profile.displayWeightUnit)}
        </p>
      </div>

      <div className="mb-3 flex items-baseline gap-3">
        <span className="text-3xl font-semibold tabular-nums">{bmi.toFixed(1)}</span>
        <span className="text-sm text-muted-foreground">{band.label}</span>
      </div>

      <div className="relative h-6">
        {BANDS.map((b, i) => {
          const left = pctForBmi(b.lo)
          const right = pctForBmi(b.hi)
          const isCurrent = b.key === band.key
          return (
            <div
              key={b.key}
              className={cn(
                "absolute top-0 h-full",
                i === 0 && "rounded-l-md",
                i === BANDS.length - 1 && "rounded-r-md",
                bandColor(b.key, isCurrent)
              )}
              style={{ left: `${left}%`, width: `${right - left}%` }}
            />
          )
        })}
        <div
          className="absolute top-[-4px] h-8 w-0.5 bg-foreground"
          style={{ left: `calc(${pctForBmi(bmi)}% - 1px)` }}
          aria-label={`BMI ${bmi.toFixed(1)}`}
        />
      </div>

      <div className="mt-1.5 grid grid-cols-4 text-[10px] uppercase tracking-wider text-muted-foreground">
        {BANDS.map((b) => (
          <span key={b.key} className="text-center">
            {b.key}
          </span>
        ))}
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground tabular-nums">
        Normal range for your height: ~{kgForBmi(18.5).toFixed(0)}–
        {kgForBmi(25).toFixed(0)} kg
      </p>
    </section>
  )
}

function bandColor(key: (typeof BANDS)[number]["key"], isCurrent: boolean): string {
  const base =
    key === "Normal"
      ? "bg-primary/30"
      : key === "Under" || key === "Over"
        ? "bg-amber-500/30"
        : "bg-destructive/30"
  const active =
    key === "Normal"
      ? "bg-primary/70"
      : key === "Under" || key === "Over"
        ? "bg-amber-500/70"
        : "bg-destructive/70"
  return isCurrent ? active : base
}
