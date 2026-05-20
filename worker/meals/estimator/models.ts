export type ModelInfo = {
  id: string
  label: string
  family: "closed" | "open"
  pricing: {
    inputPerMTokens: number
    outputPerMTokens: number
    imagePerMTokens?: number
  }
}

// Models surfaced in the admin UI dropdown. The host picks one of these and the
// choice is persisted in app_settings.vision_model. The eval harness consumes
// the same list so accuracy/cost numbers in RESULTS.md correspond to admin
// options 1:1.
//
// Ranked from the 10-dish Nutrition5K + decomposition runs:
//   - Gemini 3 Flash preview: 78% kcal, 93% identification, top default
//   - Gemini 2.5 Flash: 79% kcal, cheapest premium, current PRD default
//   - GPT-5.4 Mini: 73% kcal, fastest at ~3s, OpenAI representative
//
// Gemini 3.5 Flash added post-Google-I/O 2026. Pricing values below are
// placeholders — verify against OpenRouter's catalog before relying on
// cost-view numbers. Eval harness auto-enrolls this entry.
export const MODELS: ModelInfo[] = [
  {
    id: "google/gemini-3.5-flash",
    label: "Gemini 3.5 Flash — newest, eval pending",
    family: "closed",
    pricing: {
      inputPerMTokens: 0.5,
      outputPerMTokens: 3.0,
      imagePerMTokens: 0.5,
    },
  },
  {
    id: "google/gemini-3-flash-preview",
    label: "Gemini 3 Flash (preview) — recommended",
    family: "closed",
    pricing: {
      inputPerMTokens: 0.5,
      outputPerMTokens: 3.0,
      imagePerMTokens: 0.5,
    },
  },
  {
    id: "google/gemini-2.5-flash",
    label: "Gemini 2.5 Flash — cost-leader",
    family: "closed",
    pricing: {
      inputPerMTokens: 0.3,
      outputPerMTokens: 2.5,
      imagePerMTokens: 0.3,
    },
  },
  {
    id: "openai/gpt-5.4-mini",
    label: "GPT-5.4 Mini — fastest",
    family: "closed",
    pricing: { inputPerMTokens: 0.75, outputPerMTokens: 4.5 },
  },
]

export const DEFAULT_VISION_MODEL_ID = "google/gemini-3-flash-preview"

export function getModel(id: string): ModelInfo {
  const m = MODELS.find((m) => m.id === id)
  if (!m) throw new Error(`Unknown vision model: ${id}`)
  return m
}

export function computeCost(
  model: ModelInfo,
  usage: { promptTokens: number; completionTokens: number }
): number {
  const inCost =
    (usage.promptTokens / 1_000_000) * model.pricing.inputPerMTokens
  const outCost =
    (usage.completionTokens / 1_000_000) * model.pricing.outputPerMTokens
  return inCost + outCost
}
