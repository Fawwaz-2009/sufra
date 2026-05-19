// Promptfoo assertion: three-way error decomposition for the meal-analysis row.
//
// Uses a deterministic normalized-token matcher (no LLM judge) to pair model's
// named foods with ground-truth ingredients. Then per-matched-ingredient
// computes portion MAPE (grams) and density MAPE (kcal/g).
//
// Returns:
//   pass:  identification >= 0.5
//   score: identification coverage (headline)
//   namedScores: { identification, portion, density }
//   reason: terse human-readable summary

import { parseOutput } from "./_parse.js"
import type { Ingredient } from "../dishes.js"

type ModelFood = {
  name: string
  portionGrams: number
  estimatedKcal: number
}

type Vars = { ingredients: Ingredient[]; locale?: string }

const STRIP_ADJECTIVES = new Set([
  "fresh", "raw", "cooked", "roasted", "fried", "baked", "grilled", "boiled",
  "steamed", "diced", "sliced", "chopped", "minced", "mashed", "scrambled",
  "smoked", "cured", "crumbled", "shredded", "toasted", "mixed",
])

function normalize(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[(),\-_]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0 && !STRIP_ADJECTIVES.has(t))
    .map((t) => (t.endsWith("s") && t.length > 3 ? t.slice(0, -1) : t))
}

function jaccard(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0
  const A = new Set(a)
  const B = new Set(b)
  let inter = 0
  for (const t of A) if (B.has(t)) inter++
  return inter / (A.size + B.size - inter)
}

type Match = { modelIdx: number; quality: "exact" | "fuzzy" | "missing" }

function matchOne(gtToks: string[], modelTokens: string[][], used: Set<number>): Match {
  let bestIdx = -1
  let bestScore = 0
  let bestQuality: Match["quality"] = "missing"
  for (let i = 0; i < modelTokens.length; i++) {
    if (used.has(i)) continue
    const m = modelTokens[i]
    if (m.join(" ") === gtToks.join(" ")) return { modelIdx: i, quality: "exact" }
    const aInB = gtToks.every((t) => m.includes(t))
    const bInA = m.every((t) => gtToks.includes(t))
    const score = aInB || bInA ? 0.9 : jaccard(m, gtToks)
    if (score > bestScore) {
      bestIdx = i
      bestScore = score
      bestQuality = score >= 0.5 ? "fuzzy" : "missing"
    }
  }
  return { modelIdx: bestQuality === "missing" ? -1 : bestIdx, quality: bestQuality }
}

export default function decomposition(
  output: unknown,
  context: { test: { vars: Vars } },
) {
  // The token matcher only works in English. Skip non-English rows — the
  // locale-check scorer covers whether the model honored the locale hint.
  const locale = context.test.vars.locale ?? "en"
  if (locale !== "en") {
    return {
      pass: true,
      score: 1,
      reason: `skipped — decomposition matcher is English-only (locale=${locale})`,
    }
  }

  const analysis = parseOutput(output) as { foods: ModelFood[] }
  const groundTruth = context.test.vars.ingredients
  const modelTokens = analysis.foods.map((f) => normalize(f.name))
  const used = new Set<number>()
  let matched = 0
  const portionErrors: number[] = []
  const densityErrors: number[] = []

  for (const gt of groundTruth) {
    const gtToks = normalize(gt.name)
    const match = matchOne(gtToks, modelTokens, used)
    if (match.quality === "missing" || match.modelIdx < 0) continue
    matched++
    used.add(match.modelIdx)
    const mf = analysis.foods[match.modelIdx]
    const modelGrams = mf.portionGrams
    const modelKcalPerG = modelGrams > 0 ? mf.estimatedKcal / modelGrams : 0
    const gtKcalPerG = gt.kcal / Math.max(0.01, gt.grams)
    portionErrors.push(Math.abs(modelGrams - gt.grams) / Math.max(1, gt.grams))
    densityErrors.push(Math.abs(modelKcalPerG - gtKcalPerG) / Math.max(0.01, gtKcalPerG))
  }

  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
  const identification = matched / Math.max(1, groundTruth.length)
  const portion = portionErrors.length ? Math.max(0, 1 - mean(portionErrors)) : 0
  const density = densityErrors.length ? Math.max(0, 1 - mean(densityErrors)) : 0

  return {
    pass: identification >= 0.5,
    score: identification,
    namedScores: { identification, portion, density },
    reason: `ident=${Math.round(identification * 100)}% portion=${Math.round(portion * 100)}% density=${Math.round(density * 100)}%`,
  }
}
