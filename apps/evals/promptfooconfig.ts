import { config as loadEnv } from "dotenv"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { getSystemPrompt } from "../web/src/worker/estimator/prompts.ts"
import { MODELS } from "../web/src/worker/estimator/models.ts"
import { DISHES } from "./dishes.js"
import type { UnifiedConfig } from "promptfoo"

const here = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: join(here, ".env") })

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

// One provider entry per model, all pointing at the same file. Promptfoo loads
// estimator-provider.ts and instantiates the default-exported class with the
// per-entry config. Each invocation calls the production estimator function
// directly — no response_format / chat-completions divergence from prod.
const providers = MODELS.map((m) => ({
  id: "file://./estimator-provider.ts",
  label: m.id,
  config: { modelId: m.id },
}))

const prompts = ["{{userText}}"]

export default {
  description:
    "Sufra vision benchmark — bare vs with-hints, side-by-side per model. Calls the production estimator (worker/meals/estimator) directly via a custom provider; same code path as prod, no response_format divergence.",
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
