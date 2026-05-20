import { generateText, Output } from "ai"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"

import { MAX_IMAGE_BYTES, VisionError } from "./errors.js"
import { computeCost, DEFAULT_VISION_MODEL_ID, getModel } from "./models.js"
import { buildUserPromptText, getSystemPrompt, type Locale } from "./prompts.js"
import { MealAnalysis } from "./schema.js"

type EstimatorEnv = { OPENROUTER_API_KEY: string }

export type EstimateMealOptions = {
  modelId?: string
  locale?: Locale
  userText?: string
}

export async function estimateMeal(
  env: EstimatorEnv,
  photo: Uint8Array,
  opts: EstimateMealOptions = {}
) {
  if (!env.OPENROUTER_API_KEY) {
    throw new Error("OpenRouter API key required")
  }
  if (photo.byteLength > MAX_IMAGE_BYTES) {
    throw new VisionError(
      "image-too-large",
      `Image is ${(photo.byteLength / 1024 / 1024).toFixed(1)}MB; max ${MAX_IMAGE_BYTES / 1024 / 1024}MB. Resize client-side first.`
    )
  }

  const modelId = opts.modelId ?? DEFAULT_VISION_MODEL_ID
  const modelInfo = getModel(modelId)
  const locale = opts.locale ?? "en"
  // Locale only affects the SYSTEM prompt (which tells the model to output
  // user-read fields in the target language). The user message builder stays
  // English — it's orchestration text the model reads, not user-facing.
  const userText = buildUserPromptText({ userText: opts.userText })

  const client = createOpenRouter({
    apiKey: env.OPENROUTER_API_KEY,
    headers: {
      "HTTP-Referer": "https://github.com/fawwaz/sufra",
      "X-Title": "Sufra",
    },
  })

  const start = Date.now()
  let result
  try {
    result = await generateText({
      model: client(modelId),
      output: Output.object({ schema: MealAnalysis }),
      system: getSystemPrompt(locale),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            { type: "image", image: photo },
          ],
        },
      ],
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/no object generated|could not parse|did not match schema/i.test(msg)) {
      throw new VisionError("schema-parse-failed", msg, e)
    }
    if (/rate|429|quota/i.test(msg)) {
      throw new VisionError("rate-limited", msg, e)
    }
    throw new VisionError("provider-error", msg, e)
  }
  const latencyMs = Date.now() - start

  const usage = {
    promptTokens: result.usage.inputTokens ?? 0,
    completionTokens: result.usage.outputTokens ?? 0,
    totalTokens: result.usage.totalTokens ?? 0,
  }

  return {
    analysis: result.output,
    usage,
    costUsd: computeCost(modelInfo, usage),
    latencyMs,
    modelId,
  }
}

export type EstimateMealResult = Awaited<ReturnType<typeof estimateMeal>>

export { MealAnalysis } from "./schema.js"
export {
  MODELS,
  DEFAULT_VISION_MODEL_ID,
  getModel,
  computeCost,
  type ModelInfo,
} from "./models.js"
export {
  getSystemPrompt,
  buildUserPromptText,
  type Locale,
  type UserPromptParts,
} from "./prompts.js"
export { VisionError, MAX_IMAGE_BYTES, type VisionErrorCode } from "./errors.js"
