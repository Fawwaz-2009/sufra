import { useQuery } from "@tanstack/react-query"

import {
  CALORIE_PERIODS,
  DEFAULT_CALORIE_PERIOD,
  type CaloriePeriod,
} from "../-search"
import { calorieHistoryQueryOptions } from "../-queries"
import { CaloriesChart } from "./calories-chart"
import { PeriodChips } from "./period-chips"

export function CaloriesCard({
  period,
  onPeriodChange,
}: {
  period: CaloriePeriod
  onPeriodChange: (p: CaloriePeriod) => void
}) {
  const { data } = useQuery(
    calorieHistoryQueryOptions(period ?? DEFAULT_CALORIE_PERIOD)
  )
  const buckets = data?.buckets ?? []

  const daysWithData = buckets.reduce((acc, b) => acc + b.daysWithData, 0)
  const totalKcal = buckets.reduce((acc, b) => acc + b.kcalAvg * b.daysWithData, 0)
  const avgDaily = daysWithData > 0 ? Math.round(totalKcal / daysWithData) : 0

  return (
    <section className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="mb-1 flex items-start justify-between">
        <h2 className="font-heading text-base font-semibold">Calories</h2>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        {daysWithData > 0
          ? `Avg ${avgDaily.toLocaleString()} kcal/day · ${periodLabel(period)}`
          : `No meals · ${periodLabel(period)}`}
      </p>

      <CaloriesChart buckets={buckets} period={period} />

      <div className="mt-3">
        <PeriodChips
          options={CALORIE_PERIODS}
          value={period}
          onChange={onPeriodChange}
        />
      </div>
    </section>
  )
}

function periodLabel(p: CaloriePeriod): string {
  switch (p) {
    case "7D":
      return "last 7 days"
    case "30D":
      return "last 30 days"
    case "90D":
      return "last 90 days"
    case "1Y":
      return "last year"
  }
}
