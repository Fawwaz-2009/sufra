import { parseOutput } from "./_parse.js"

// Macros total = sum of per-food macros. No top-level total in the schema.
type Analysis = {
  foods?: Array<{
    estimatedProteinG?: number
    estimatedCarbsG?: number
    estimatedFatG?: number
  }>
}

type Vars = {
  expectedProteinG: number
  expectedCarbsG: number
  expectedFatG: number
}

export default function macroMape(
  output: unknown,
  context: { test: { vars: Vars } },
) {
  const a = parseOutput(output) as Analysis
  const v = context.test.vars
  const foods = a.foods ?? []
  const e = {
    proteinG: foods.reduce((s, f) => s + (f.estimatedProteinG ?? 0), 0),
    carbsG: foods.reduce((s, f) => s + (f.estimatedCarbsG ?? 0), 0),
    fatG: foods.reduce((s, f) => s + (f.estimatedFatG ?? 0), 0),
  }
  const errs = [
    Math.abs(e.proteinG - v.expectedProteinG) / Math.max(1, v.expectedProteinG),
    Math.abs(e.carbsG - v.expectedCarbsG) / Math.max(1, v.expectedCarbsG),
    Math.abs(e.fatG - v.expectedFatG) / Math.max(1, v.expectedFatG),
  ]
  const meanMape = errs.reduce((a, b) => a + b, 0) / errs.length
  const score = Math.max(0, 1 - meanMape)
  return {
    pass: score >= 0.5,
    score,
    reason: `P${e.proteinG.toFixed(1)}|${v.expectedProteinG} C${e.carbsG.toFixed(1)}|${v.expectedCarbsG} F${e.fatG.toFixed(1)}|${v.expectedFatG} (avg ${Math.round(meanMape * 100)}% off)`,
  }
}
