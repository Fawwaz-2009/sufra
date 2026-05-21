import { CurrencyDollar } from "@phosphor-icons/react"

export function CostCard({
  totalUsd,
  perMemberAvgUsd,
  runCount,
}: {
  totalUsd: number
  perMemberAvgUsd: number
  runCount: number
}) {
  return (
    <div className="mb-6 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex items-start gap-3">
        <CurrencyDollar className="size-6 shrink-0" weight="bold" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">
            Inference cost this month
          </p>
          <div className="mt-1 flex items-baseline justify-between gap-2">
            <span className="font-heading text-2xl font-semibold tabular-nums">
              ${totalUsd.toFixed(2)}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              ~${perMemberAvgUsd.toFixed(2)} / member
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground tabular-nums">
            {runCount} {runCount === 1 ? "run" : "runs"}
          </p>
        </div>
      </div>
    </div>
  )
}
