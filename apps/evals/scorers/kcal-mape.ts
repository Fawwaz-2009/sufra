import { parseOutput } from "./_parse.js"

// Meal kcal = sum of per-food kcal. No top-level total in the schema.
type Analysis = { foods?: Array<{ estimatedKcal?: number }> }
type Context = { test: { vars: { expectedKcal: number } } }

export default function kcalMape(output: unknown, context: Context) {
  const a = parseOutput(output) as Analysis
  const truth = context.test.vars.expectedKcal
  const est = (a.foods ?? []).reduce(
    (sum, f) => sum + (f.estimatedKcal ?? 0),
    0,
  )
  const mape = truth > 0 ? Math.abs(est - truth) / truth : 1
  const score = Math.max(0, 1 - mape)
  return {
    pass: score >= 0.5,
    score,
    reason: `kcal est=${est} (∑ foods) truth=${truth} (${Math.round(mape * 100)}% off)`,
  }
}
