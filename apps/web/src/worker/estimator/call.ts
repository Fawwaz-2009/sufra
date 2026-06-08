import { generateText, Output, jsonSchema } from "ai"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { MEAL_ANALYSIS_JSON_SCHEMA } from "../models/meal-analysis.ts"
import { getSystemPrompt, buildUserPromptText, type Locale } from "./prompts.ts"

/**
 * The BARE vision-model invocation — the one place that talks to OpenRouter. Shared by the production
 * estimator (`EstimatorLive`, locale "en") AND the eval harness (`apps/evals`, which exercises the locale
 * plumbing). Sharing it is the eval's whole reason to exist: SAME model, system prompt
 * (`getSystemPrompt`), user prompt (`buildUserPromptText`), derived JSON Schema (`MEAL_ANALYSIS_JSON_SCHEMA`),
 * and `response_format` (`Output.object`) as the deployed call — so an eval result can never drift from prod.
 *
 * Returns the raw AI-SDK result (`result.output` + `result.usage`); the caller decodes through the
 * single-source `MealAnalysis` and maps usage/cost. Throws on a provider/parse failure — `EstimatorLive`
 * wraps that in its typed `EstimateFailure` + audit; the eval provider catches it into a promptfoo error.
 * The only knob the eval needs that prod doesn't is `locale` (prod hardcodes "en").
 */
export const callVisionModel = (input: {
  readonly apiKey: string
  readonly modelId: string
  readonly photo: Uint8Array
  readonly locale?: Locale
  readonly userText?: string
}) => {
  const client = createOpenRouter({
    apiKey: input.apiKey,
    headers: { "HTTP-Referer": "https://github.com/fawwaz/sufra", "X-Title": "Sufra" }
  })
  return generateText({
    model: client(input.modelId),
    output: Output.object({
      schema: jsonSchema(MEAL_ANALYSIS_JSON_SCHEMA as Parameters<typeof jsonSchema>[0])
    }),
    system: getSystemPrompt(input.locale ?? "en"),
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: buildUserPromptText({ userText: input.userText }) },
          { type: "image", image: input.photo }
        ]
      }
    ]
  })
}
