import { config as loadEnv } from "dotenv"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { zodResponseFormat } from "openai/helpers/zod"
import { MealAnalysis } from "../worker/meal-analysis/schema.js"
import { getSystemPrompt } from "../worker/meal-analysis/prompts.js"
import { MODELS } from "../worker/meal-analysis/models.js"
import { DISHES } from "./dishes.js"
import type { UnifiedConfig } from "promptfoo"

const here = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: join(here, ".env") })

const responseFormat = zodResponseFormat(MealAnalysis, "meal_analysis")

// Test variants per dish:
//   bare        — analyze the image alone
//   with-hints  — analyze the image + pre-baked user portion context
// Plus ONE Arabic-locale variant on the first dish, to verify the model
// follows the locale hint (the only place we test multi-language; no need
// to re-run the full matrix in every supported language).
const baseVars = (d: (typeof DISHES)[number]) => ({
  imageUrl: d.imageUrl,
  expectedKcal: d.kcal,
  expectedProteinG: d.proteinG,
  expectedCarbsG: d.carbsG,
  expectedFatG: d.fatG,
  dishKey: d.dishKey,
  ingredients: d.ingredients,
})

const tests = [
  ...DISHES.flatMap((d) => [
    {
      description: `${d.dishKey} | bare`,
      vars: {
        ...baseVars(d),
        variant: "bare",
        locale: "en",
        systemPrompt: getSystemPrompt("en"),
        userText: "Analyze this meal photo.",
      },
    },
    {
      description: `${d.dishKey} | with-hints`,
      vars: {
        ...baseVars(d),
        variant: "with-hints",
        locale: "en",
        systemPrompt: getSystemPrompt("en"),
        userText: `Analyze this meal photo. ${d.userContext}`,
      },
    },
  ]),
  // Locale-follow check: one dish, all 3 models, Arabic locale, bare variant.
  // The locale-check scorer verifies foods[].name / clarifications[].question
  // contain Arabic-script characters. Accuracy is measured by the same
  // scorers so we don't regress on numbers when localizing.
  {
    description: `${DISHES[0].dishKey} | bare | locale=ar`,
    vars: {
      ...baseVars(DISHES[0]),
      variant: "bare",
      locale: "ar",
      systemPrompt: getSystemPrompt("ar"),
      userText: "Analyze this meal photo.",
    },
  },
]

const providers = MODELS.map((m) => ({
  id: `openai:chat:${m.id}`,
  label: m.id,
  config: {
    apiBaseUrl: "https://openrouter.ai/api/v1",
    apiKeyEnvar: "OPENROUTER_API_KEY",
    response_format: responseFormat,
    max_completion_tokens: 4000,
  },
}))

const prompts = ["file://./prompt.ts"]

export default {
  description:
    "Sufra vision benchmark — bare vs with-hints, side-by-side per model. Schema imported live from worker/meal-analysis/, no drift.",
  commandLineOptions: {
    maxConcurrency: 10,
  },
  prompts,
  providers,
  tests,
  defaultTest: {
    assert: [
      { type: "javascript", value: "file://./scorers/kcal-mape.ts" },
      { type: "javascript", value: "file://./scorers/macro-mape.ts" },
      { type: "javascript", value: "file://./scorers/decomposition.ts" },
      { type: "javascript", value: "file://./scorers/locale-check.ts" },
    ],
  },
} satisfies UnifiedConfig
