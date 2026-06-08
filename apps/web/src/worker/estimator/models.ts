/**
 * The vision models surfaced in the Admin dropdown (Host picks one; the choice is persisted in
 * `app_settings` — a Slice 4 concern, so Slice 2 defaults to `DEFAULT_VISION_MODEL_ID`). The eval
 * harness consumes the same list so RESULTS.md numbers map 1:1 to admin options.
 *
 * Plain data + pure cost math — no AI SDK, no bindings — so the Admin UI (browser) can import it too.
 */
export interface ModelInfo {
  readonly id: string
  readonly label: string
  readonly family: "closed" | "open"
  readonly pricing: {
    readonly inputPerMTokens: number
    readonly outputPerMTokens: number
    readonly imagePerMTokens?: number
  }
}

export const MODELS: ReadonlyArray<ModelInfo> = [
  {
    id: "google/gemini-3.5-flash",
    label: "Gemini 3.5 Flash — newest, eval pending",
    family: "closed",
    pricing: { inputPerMTokens: 0.5, outputPerMTokens: 3.0, imagePerMTokens: 0.5 }
  },
  {
    id: "google/gemini-3-flash-preview",
    label: "Gemini 3 Flash (preview) — recommended",
    family: "closed",
    pricing: { inputPerMTokens: 0.5, outputPerMTokens: 3.0, imagePerMTokens: 0.5 }
  },
  {
    id: "google/gemini-2.5-flash",
    label: "Gemini 2.5 Flash — cost-leader",
    family: "closed",
    pricing: { inputPerMTokens: 0.3, outputPerMTokens: 2.5, imagePerMTokens: 0.3 }
  },
  {
    id: "openai/gpt-5.4-mini",
    label: "GPT-5.4 Mini — fastest",
    family: "closed",
    pricing: { inputPerMTokens: 0.75, outputPerMTokens: 4.5 }
  }
]

export const DEFAULT_VISION_MODEL_ID = "google/gemini-3-flash-preview"

export const getModel = (id: string): ModelInfo => {
  const m = MODELS.find((m) => m.id === id)
  if (m === undefined) throw new Error(`Unknown vision model: ${id}`)
  return m
}

export const computeCost = (
  model: ModelInfo,
  usage: { readonly promptTokens: number; readonly completionTokens: number }
): number => {
  const inCost = (usage.promptTokens / 1_000_000) * model.pricing.inputPerMTokens
  const outCost = (usage.completionTokens / 1_000_000) * model.pricing.outputPerMTokens
  return inCost + outCost
}
