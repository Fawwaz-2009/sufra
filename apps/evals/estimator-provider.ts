import type {
  ApiProvider,
  CallApiContextParams,
  ProviderOptions,
  ProviderResponse,
} from "promptfoo"
import * as Schema from "effect/Schema"

import { callVisionModel } from "../web/src/worker/estimator/call.ts"
import { computeCost, getModel } from "../web/src/worker/estimator/models.ts"
import { MealAnalysis } from "../web/src/worker/models/meal-analysis.ts"
import type { Locale } from "../web/src/worker/estimator/prompts.ts"

// Promptfoo custom provider that exercises the PRODUCTION vision call directly: `callVisionModel` is the
// exact OpenRouter invocation `EstimatorLive` runs (same model, system + user prompts, derived JSON
// Schema, response_format), and the output is decoded through the SAME single-source `MealAnalysis`. No
// response_format divergence, no schema/prompt drift. The only knob prod doesn't expose is `locale` (prod
// hardcodes "en"); the harness exercises the locale plumbing.

const decodeAnalysis = Schema.decodeUnknownSync(MealAnalysis)

export default class EstimatorProvider implements ApiProvider {
  private providerId: string
  private modelId: string

  constructor(options: ProviderOptions) {
    this.providerId = options.id ?? "estimator"
    const modelId = options.config?.modelId
    if (typeof modelId !== "string" || modelId.length === 0) {
      throw new Error(
        "EstimatorProvider requires config.modelId (e.g. google/gemini-3.5-flash)"
      )
    }
    this.modelId = modelId
  }

  id(): string {
    return this.providerId
  }

  async callApi(
    _prompt: string,
    context?: CallApiContextParams
  ): Promise<ProviderResponse> {
    const vars = context?.vars ?? {}
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      return {
        error: "OPENROUTER_API_KEY not set",
        tokenUsage: { total: 0, prompt: 0, completion: 0 },
      }
    }

    const imageUrl = vars.imageUrl as string | undefined
    if (!imageUrl) {
      return {
        error: "test vars.imageUrl missing",
        tokenUsage: { total: 0, prompt: 0, completion: 0 },
      }
    }

    const locale = (vars.locale as Locale | undefined) ?? "en"
    const userText = stripPromptPrefix(vars.userText as string | undefined)
    const photo = dataUrlToBytes(imageUrl)

    try {
      const result = await callVisionModel({ apiKey, modelId: this.modelId, photo, locale, userText })
      const analysis = decodeAnalysis(result.output)
      const prompt = result.usage.inputTokens ?? 0
      const completion = result.usage.outputTokens ?? 0
      return {
        output: analysis,
        // Prefer the provider's authoritative `totalTokens` for the display total — for reasoning-capable
        // models it exceeds prompt+completion (reasoning tokens). Cost still uses prompt/completion only
        // (the prod `EstimateUsage` shape — `computeCost` never saw a total).
        tokenUsage: { total: result.usage.totalTokens ?? prompt + completion, prompt, completion },
        cost: computeCost(getModel(this.modelId), { promptTokens: prompt, completionTokens: completion }),
      }
    } catch (e) {
      return {
        error: e instanceof Error ? e.message : String(e),
        tokenUsage: { total: 0, prompt: 0, completion: 0 },
      }
    }
  }
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const match = dataUrl.match(/^data:[^;]+;base64,(.+)$/)
  if (!match) throw new Error("expected data URL with base64 payload")
  return Uint8Array.from(Buffer.from(match[1]!, "base64"))
}

// dishes.ts builds vars.userText as "Analyze this meal photo." for the bare variant and
// "Analyze this meal photo. ${userContext}" for with-hints. `buildUserPromptText` (inside
// callVisionModel) already prepends "Analyze this meal photo.", so strip that prefix and pass only the
// *extra* context (if any).
function stripPromptPrefix(text: string | undefined): string | undefined {
  if (!text) return undefined
  const cleaned = text.replace(/^Analyze this meal photo\.\s*/i, "").trim()
  return cleaned.length > 0 ? cleaned : undefined
}
