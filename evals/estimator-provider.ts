import type {
  ApiProvider,
  CallApiContextParams,
  ProviderOptions,
  ProviderResponse,
} from "promptfoo"

import {
  estimateMeal,
  type Locale,
} from "../worker/meals/estimator/index.js"

// Promptfoo custom provider that exercises the production estimator function
// directly. Every test variant in the matrix calls estimateMeal(env, photo, opts)
// — the same code the Worker runs in production. No response_format divergence,
// no thinking-mode leaks, no schema/prompt drift.

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
      const result = await estimateMeal(
        { OPENROUTER_API_KEY: apiKey },
        photo,
        { modelId: this.modelId, locale, userText }
      )
      return {
        output: result.analysis,
        tokenUsage: {
          total: result.usage.totalTokens,
          prompt: result.usage.promptTokens,
          completion: result.usage.completionTokens,
        },
        cost: result.costUsd,
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
  return Uint8Array.from(Buffer.from(match[1], "base64"))
}

// dishes.ts builds vars.userText as "Analyze this meal photo." for the bare
// variant and "Analyze this meal photo. ${userContext}" for with-hints. The
// estimator internally prepends "Analyze this meal photo." via buildUserPromptText,
// so we strip that prefix here and pass only the *extra* context (if any).
function stripPromptPrefix(text: string | undefined): string | undefined {
  if (!text) return undefined
  const cleaned = text.replace(/^Analyze this meal photo\.\s*/i, "").trim()
  return cleaned.length > 0 ? cleaned : undefined
}
