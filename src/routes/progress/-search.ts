import { z } from "zod"

// Period chips persist in the URL — a refresh keeps the Member's pick, and
// the choices are linkable. Defaults match the design's active chip in each
// card: 1M for Weight, 7D for Calories.

export const WEIGHT_PERIODS = ["1M", "3M", "6M", "1Y"] as const
export const CALORIE_PERIODS = ["7D", "30D", "90D", "1Y"] as const

export type WeightPeriod = (typeof WEIGHT_PERIODS)[number]
export type CaloriePeriod = (typeof CALORIE_PERIODS)[number]

export const progressSearchSchema = z.object({
  wp: z.enum(WEIGHT_PERIODS).optional(),
  cp: z.enum(CALORIE_PERIODS).optional(),
})

export type ProgressSearch = z.infer<typeof progressSearchSchema>

export const DEFAULT_WEIGHT_PERIOD: WeightPeriod = "1M"
export const DEFAULT_CALORIE_PERIOD: CaloriePeriod = "7D"

// Calories bucket granularity per period. Day-bars when there are few enough
// to fit (≤30); rolled up beyond that so the chart stays readable on mobile.
export function calorieBucketFor(p: CaloriePeriod): "day" | "week" | "month" {
  switch (p) {
    case "7D":
    case "30D":
      return "day"
    case "90D":
      return "week"
    case "1Y":
      return "month"
  }
}

// Resolve a period chip into a UTC date range anchored at "now" in the
// Member's local TZ. End is exclusive — matches the meals/weights range
// semantics. Start is `period` days/months before today, midnight-local.
export function weightPeriodRange(
  p: WeightPeriod,
  now: Date = new Date()
): { from: string; to: string } {
  const toMidnightLocal = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1
  )
  const monthsBack = p === "1M" ? 1 : p === "3M" ? 3 : p === "6M" ? 6 : 12
  const from = new Date(
    now.getFullYear(),
    now.getMonth() - monthsBack,
    now.getDate()
  )
  return { from: from.toISOString(), to: toMidnightLocal.toISOString() }
}

export function caloriePeriodRange(
  p: CaloriePeriod,
  now: Date = new Date()
): { from: string; to: string } {
  const toMidnightLocal = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1
  )
  let from: Date
  if (p === "7D") {
    from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
  } else if (p === "30D") {
    from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29)
  } else if (p === "90D") {
    from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 89)
  } else {
    from = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate() + 1)
  }
  return { from: from.toISOString(), to: toMidnightLocal.toISOString() }
}
