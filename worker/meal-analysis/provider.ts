import type { MealAnalysis } from "./schema.js"
import type { Locale } from "./prompts.js"

export type { MealAnalysis }

// Public input/output contract for any vision provider. The Worker depends only
// on this interface; OpenRouterProvider is the v1 implementation but Ollama or
// a direct Anthropic/Google integration can drop in later by satisfying the
// same shape — per PRD §8.3.

export type MealAnalysisInput = {
  image: Uint8Array
  modelId?: string
  locale?: Locale
  userText?: string
}

export type Usage = {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export type MealAnalysisResult = {
  analysis: MealAnalysis
  usage: Usage
  costUsd: number
  latencyMs: number
  modelId: string
}

export interface VisionProvider {
  analyzeMeal(input: MealAnalysisInput): Promise<MealAnalysisResult>
}
