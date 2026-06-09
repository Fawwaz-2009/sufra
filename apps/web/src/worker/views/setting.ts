import * as Schema from "effect/Schema"
import { AppSetting } from "../models/app-setting.ts"

/**
 * App settings as the Admin surface reads and edits them — the vision model the estimator uses and the
 * family name. Plain JSON. The singleton `id` and `updatedAt` audit stamp are intentionally omitted (the
 * Host edits values, not the row identity).
 */
export const SettingsView = Schema.Struct({
  visionModelId: Schema.String,
  familyName: Schema.String
})
export type SettingsView = typeof SettingsView.Type
export type SettingsViewEncoded = typeof SettingsView.Encoded

/** Serialize an app_settings row → its view. */
export const toSettingsView = (row: typeof AppSetting.select.Type): SettingsView => ({
  visionModelId: row.visionModelId,
  familyName: row.familyName
})

/**
 * The vision-model catalog — NOT a first-class concept, but the ALLOWED VALUES for the `visionModelId`
 * setting plus each model's price. It lives HERE (a detail of Settings), browser-safe: the Admin dropdown
 * renders it, `contract/settings.ts` builds its `Literals` validation from the ids, the estimatable concern
 * computes cost from the pricing, and the eval harness lists it. A curated CODE catalog (not a table) tied
 * 1:1 to the eval RESULTS — the Host selects one; the choice is stored in `app_settings`.
 */
export interface VisionModel {
  readonly id: string
  readonly label: string
  readonly family: "closed" | "open"
  readonly pricing: {
    readonly inputPerMTokens: number
    readonly outputPerMTokens: number
    readonly imagePerMTokens?: number
  }
}

export const VISION_MODELS: ReadonlyArray<VisionModel> = [
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

/**
 * Resolve a stored model id to its catalog entry, FALLING BACK to the default if the id is stale (removed
 * or renamed in the catalog). The stored selection is validated against the catalog at WRITE time
 * (`contract/settings.ts` Literals), but a later catalog edit could orphan it — this read-time guard means
 * a catalog change can never break meal capture (the FK-like integrity of a code catalog, ADR 0017).
 */
export const resolveVisionModel = (id: string): VisionModel => {
  const found = VISION_MODELS.find((m) => m.id === id)
  if (found !== undefined) return found
  const fallback = VISION_MODELS.find((m) => m.id === DEFAULT_VISION_MODEL_ID)
  if (fallback === undefined) throw new Error("vision model catalog is empty")
  return fallback
}

/** Token-derived cost in USD for one call (display/audit). Pure + browser-safe, the `views/derive.ts` flavor. */
export const computeCost = (
  model: VisionModel,
  usage: { readonly promptTokens: number; readonly completionTokens: number }
): number => {
  const inCost = (usage.promptTokens / 1_000_000) * model.pricing.inputPerMTokens
  const outCost = (usage.completionTokens / 1_000_000) * model.pricing.outputPerMTokens
  return inCost + outCost
}
