import { generateText, Output } from "ai"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { MealAnalysis } from "./schema.js"
import { getSystemPrompt, buildUserPromptText } from "./prompts.js"
import { computeCost, DEFAULT_VISION_MODEL_ID, getModel } from "./models.js"
import { MAX_IMAGE_BYTES, VisionError } from "./errors.js"
import type {
  MealAnalysisInput,
  MealAnalysisResult,
  VisionProvider,
} from "./provider.js"

export type OpenRouterProviderOptions = {
  apiKey: string
  defaultModelId?: string
  appReferer?: string
  appTitle?: string
}

export function createOpenRouterProvider(
  opts: OpenRouterProviderOptions
): VisionProvider {
  if (!opts.apiKey) {
    throw new Error("OpenRouter API key required")
  }
  const client = createOpenRouter({
    apiKey: opts.apiKey,
    headers: {
      "HTTP-Referer": opts.appReferer ?? "https://github.com/fawwaz/sufra",
      "X-Title": opts.appTitle ?? "Sufra",
    },
  })
  const defaultModelId = opts.defaultModelId ?? DEFAULT_VISION_MODEL_ID

  return {
    async analyzeMeal(input: MealAnalysisInput): Promise<MealAnalysisResult> {
      if (input.image.byteLength > MAX_IMAGE_BYTES) {
        throw new VisionError(
          "image-too-large",
          `Image is ${(input.image.byteLength / 1024 / 1024).toFixed(1)}MB; max ${MAX_IMAGE_BYTES / 1024 / 1024}MB. Resize client-side first.`
        )
      }

      const modelId = input.modelId ?? defaultModelId
      const modelInfo = getModel(modelId)
      const locale = input.locale ?? "en"
      // Locale only affects the SYSTEM prompt (which tells the model to output
      // user-read fields in the target language). The user message builder stays
      // English — it's orchestration text the model reads, not user-facing.
      const userText = buildUserPromptText({ userText: input.userText })

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
                { type: "image", image: input.image },
              ],
            },
          ],
        })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        if (
          /no object generated|could not parse|did not match schema/i.test(msg)
        ) {
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
    },
  }
}
