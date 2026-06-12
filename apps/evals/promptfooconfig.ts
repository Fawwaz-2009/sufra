import { config as loadEnv } from "dotenv"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { getSystemPrompt } from "../web/src/worker/domain/meal/estimatable/vision.ts"
import { VISION_MODELS } from "../web/src/worker/views/setting.ts"
import { DISHES } from "./dishes.js"
import type { UnifiedConfig } from "promptfoo"

const here = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: join(here, ".env") })

// Test variants per dish:
//   bare        — analyze the image alone
//   with-hints  — analyze the image + pre-baked user portion context
//   text        — NO image: the meal described in text alone (the Describe door, ADR 0019)
// Plus Arabic-locale variants (ADR 0020 — prod sends the client's locale): one bare photo,
// one with-hints photo with the hint written in Arabic, and two text descriptions written
// in Arabic (the realistic Describe input for an Arabic Member; Western digits per the rule).
// The locale-check scorer verifies the user-read fields come back in Arabic script;
// kcal/macro MAPE keep scoring accuracy so localizing can't silently regress the numbers.
const baseVars = (d: (typeof DISHES)[number]) => ({
  imageUrl: d.imageUrl,
  expectedKcal: d.kcal,
  expectedProteinG: d.proteinG,
  expectedCarbsG: d.carbsG,
  expectedFatG: d.fatG,
  dishKey: d.dishKey,
  ingredients: d.ingredients,
})

// The text-source twin of baseVars: NO imageUrl, so the provider takes the photo-less path.
const textVars = (d: (typeof DISHES)[number]) => {
  const { imageUrl: _imageUrl, ...rest } = baseVars(d)
  return rest
}

// A text description with the same portion fidelity as the with-hints variant — what a
// diligent Describe user would type. Tests the text path's numeric handling, apples-to-apples
// with the photo variants.
const describe = (d: (typeof DISHES)[number]): string =>
  `I ate: ${d.ingredients.map((i) => `${i.name} ${Math.round(i.grams)}g`).join(", ")}.`

// Hand-written Arabic Describe inputs for the first two dishes (same portions as ground
// truth; Western digits per the vision-prompt rule, mirrored in UI formatting — ADR 0020).
const AR_DESCRIBE: Record<string, string> = {
  dish_1558459115: "أكلت: لوز 20 غرام، تفاحة 143 غرام، رز أبيض 32 غرام، طماطم كرزية 61 غرام، وعنب 42 غرام.",
  dish_1558380557: "أكلت: عنب 52 غرام، لوز 48 غرام، ونقانق 112 غرام.",
}

const AR_HINT_DISH0 =
  "ملاحظة من المستخدم: الكميات في الصحن هي لوز 20 غرام، تفاحة 143 غرام، رز أبيض 32 غرام، طماطم كرزية 61 غرام، وعنب 42 غرام."

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
  // The text source (ADR 0019): every dish described in text alone, portions included —
  // the Describe door's accuracy, side by side with bare/with-hints.
  ...DISHES.map((d) => ({
    description: `${d.dishKey} | text`,
    vars: {
      ...textVars(d),
      variant: "text",
      locale: "en",
      systemPrompt: getSystemPrompt("en", "text"),
      userText: describe(d),
    },
  })),
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
  // Photo + an ARABIC user hint (the realistic Refinement/with-hints input from an Arabic
  // Member): does mixing Arabic context into the photo path hold the numbers AND the locale?
  {
    description: `${DISHES[0].dishKey} | with-hints | locale=ar`,
    vars: {
      ...baseVars(DISHES[0]),
      variant: "with-hints",
      locale: "ar",
      systemPrompt: getSystemPrompt("ar"),
      userText: `Analyze this meal photo. ${AR_HINT_DISH0}`,
    },
  },
  // The Describe door in Arabic — the new prod surface ADR 0019+0020 combine to create.
  ...DISHES.slice(0, 2).map((d) => ({
    description: `${d.dishKey} | text | locale=ar`,
    vars: {
      ...textVars(d),
      variant: "text",
      locale: "ar",
      systemPrompt: getSystemPrompt("ar", "text"),
      userText: AR_DESCRIBE[d.dishKey]!,
    },
  })),
]

// One provider entry per model, all pointing at the same file. Promptfoo loads
// estimator-provider.ts and instantiates the default-exported class with the
// per-entry config. Each invocation calls the production estimator function
// directly — no response_format / chat-completions divergence from prod.
const providers = VISION_MODELS.map((m) => ({
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
