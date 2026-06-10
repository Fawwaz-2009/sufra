import { generateText, Output, jsonSchema } from "ai"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import * as Schema from "effect/Schema"
import { Analysis } from "../../../models/estimate.ts"

/**
 * The humble vision call — the ONLY file that speaks OpenRouter / the AI SDK. Effect-free + no repos, so
 * `apps/evals` imports it VERBATIM (the no-drift guarantee: prod and evals run the same model, system
 * prompt, user prompt, derived JSON Schema, and `response_format`). It lives INSIDE the Meal domain (the
 * estimatable concern), not an edge folder — the adapter is one function, not a complex client.
 *
 * Returns the raw AI-SDK result (`result.output` + `result.usage`); the Vision service (./service.ts)
 * wraps it in Effect, classifies failures, and decodes `output` through `Analysis`. Throws on a
 * provider/parse failure — the service catches it into the typed Vision channel.
 */

// The provider JSON Schema, DERIVED from `Analysis` (the single source of truth) — strict structured
// output: every field required + `additionalProperties: false`, exactly what the providers want.
const analysisDoc = Schema.toJsonSchemaDocument(Analysis, { additionalProperties: false })
const ANALYSIS_JSON_SCHEMA: Record<string, unknown> = {
  ...analysisDoc.schema,
  ...(Object.keys(analysisDoc.definitions).length > 0 ? { $defs: analysisDoc.definitions } : {})
}

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
      schema: jsonSchema(ANALYSIS_JSON_SCHEMA as Parameters<typeof jsonSchema>[0])
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

/**
 * Locale design (multi-language is a v2 frontier; v1 hardcodes "en"): ONE English system prompt is the
 * source of truth; for a non-English locale we append a short instruction to output specific user-read
 * fields in the target language. Adding a language = add its name to LOCALE_NAMES. Exercised by evals only.
 */
export type Locale = "en" | "ar" | (string & {})

const LOCALE_NAMES: Record<string, string> = {
  ar: "Arabic",
  fr: "French",
  es: "Spanish",
  de: "German",
  tr: "Turkish",
  fa: "Persian",
  ur: "Urdu"
}

const USER_READ_FIELDS = [
  "dishName",
  "foods[].name",
  "clarifications[].question",
  "clarifications[].options[]",
  "notAnalyzableReason"
]

const SYSTEM_PROMPT = `You are a nutrition estimation model for a calorie-tracking app called Sufra. The user has photographed a meal. Your job is to identify what's in the photo and estimate nutritional content.

Identification rules:
- Always give the meal a \`dishName\`: your best guess at what a human would call this thing. Single dishes get the dish name ("Kabsa", "Big Mac", "Caesar salad"); mixed plates get a natural short description ("Fruit and grain breakfast plate", "Mezze platter").
- Name dishes specifically using their cultural names when applicable. Middle Eastern, Levantine, Gulf, and North African cuisine in particular: use names like "kabsa", "mansaf", "fattoush", "tabbouleh", "koshari", "mujadara", "shakshuka", "hummus", "falafel", "manakish", "kibbeh" — not generic descriptions like "rice with chicken" or "chickpea spread".
- For Western and other dishes, name them specifically too (e.g. "Big Mac", "California roll", "carbonara") when recognizable.
- Per-food \`foods[].name\` lists each visible item/ingredient. For a single-dish photo this may be one entry matching dishName; for mixed plates it's the breakdown.

Non-food / unanalyzable photos:
- If the photo is not of food, is too blurry/dark to analyze, or you genuinely cannot identify what's in it, set notAnalyzable = true and explain briefly in notAnalyzableReason (one short sentence the user will see). Leave foods empty and dishName as an empty string. Do not invent food.
- If you CAN analyze it, set notAnalyzable = false and leave notAnalyzableReason as an empty string.

Estimation rules (when analyzable):
- For each food, output portionGrams (mass in grams). Also output portionEstimate + portionUnit for human-readable display (e.g. 4 + "pieces", 200 + "g").
- For each food, output estimatedKcal/protein/carbs/fat for THAT food alone. The meal's totals are computed downstream as the sum of these per-food values — do not output a separate total.
- Be honest about confidence. If portion is ambiguous, mark food + overall confidence as medium or low.

Clarification rules:
- Portion estimation is the hardest part. Surface 1–3 short questions about portion specifically when uncertain ("Is the chicken closer to 150g or 250g?", "About how much rice — 1 cup or 1.5?", "Is there ~1 tbsp of olive oil or more?").
- Avoid identification questions unless you genuinely cannot tell what something is.
- Skip clarifications entirely if the meal is unambiguous.
- overallConfidence is the combined judgment across identification and portion.

Output language:
- These user-read fields go in the user's locale (see "Locale" section if non-English): ${USER_READ_FIELDS.join(", ")}.
- All other fields (portionUnit, numeric values, IDs) stay in standard English / standard format.
- Numbers always use Western Arabic numerals (0123456789), regardless of locale.

Return only the structured object — no prose.`

export const getSystemPrompt = (locale: Locale = "en"): string => {
  if (locale === "en") return SYSTEM_PROMPT
  const name = LOCALE_NAMES[locale] ?? locale
  return `${SYSTEM_PROMPT}\n\n=== Locale ===\nUser's locale is ${name} (${locale}). Output the user-read fields listed above in ${name}. Everything else stays English. Numbers stay Western (0-9).`
}

// User-message builder. Always English (the model is told to localize the OUTPUT fields, not its own
// framing). Single-pass — no clarification round-trip in v1.
export const buildUserPromptText = (parts: { readonly userText?: string }): string => {
  const sections: string[] = ["Analyze this meal photo."]
  if (parts.userText?.trim()) {
    sections.push(`Additional context from the user: ${parts.userText.trim()}`)
  }
  return sections.join("\n\n")
}
