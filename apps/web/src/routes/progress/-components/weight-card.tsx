import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Pencil } from "lucide-react"

import { LogWeightSheet } from "@/components/log-weight-sheet"
import { formatWeight } from "@/lib/units"
import type { ProfileSnapshot } from "../../../../worker/profile/schema"
import {
  DEFAULT_WEIGHT_PERIOD,
  WEIGHT_PERIODS,
  type WeightPeriod,
} from "../-search"
import { weightsQueryOptions } from "../-queries"
import { PeriodChips } from "./period-chips"
import { WeightChart } from "./weight-chart"

export function WeightCard({
  profile,
  period,
  onPeriodChange,
}: {
  profile: ProfileSnapshot
  period: WeightPeriod
  onPeriodChange: (p: WeightPeriod) => void
}) {
  const [logOpen, setLogOpen] = useState(false)
  const { data } = useQuery(weightsQueryOptions(period ?? DEFAULT_WEIGHT_PERIOD))
  const weights = data?.weights ?? []

  const latest = weights.length > 0 ? weights[weights.length - 1]! : null
  const latestLabel = latest
    ? `Latest: ${formatWeight(latest.weightKg, profile.displayWeightUnit)} · ${relativeDate(latest.loggedAt)}`
    : null

  return (
    <section className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="mb-1 flex items-start justify-between">
        <h2 className="font-heading text-base font-semibold">Weight over time</h2>
        <button
          type="button"
          onClick={() => setLogOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-foreground/10 px-3 py-1.5 text-xs font-medium hover:bg-foreground/5"
        >
          <Pencil className="size-3.5" strokeWidth={2.5} />
          Log weight
        </button>
      </div>
      {latestLabel && (
        <p className="mb-3 text-xs text-muted-foreground">{latestLabel}</p>
      )}

      <WeightChart weights={weights} />

      <div className="mt-3">
        <PeriodChips
          options={WEIGHT_PERIODS}
          value={period}
          onChange={onPeriodChange}
        />
      </div>

      <LogWeightSheet
        open={logOpen}
        onOpenChange={setLogOpen}
        profile={profile}
      />
    </section>
  )
}

// "Today" / "Yesterday" / "3 days ago" for recent, absolute date beyond.
function relativeDate(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const dayMs = 86_400_000
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const b = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const diff = Math.round((b - a) / dayMs)
  if (diff === 0) return "Today"
  if (diff === 1) return "Yesterday"
  if (diff > 1 && diff <= 7) return `${diff} days ago`
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}
