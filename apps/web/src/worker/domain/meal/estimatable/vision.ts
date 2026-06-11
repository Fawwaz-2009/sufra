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
  readonly photo?: Uint8Array | undefined
  readonly locale?: Locale
  readonly userText?: string
}) => {
  const client = createOpenRouter({
    apiKey: input.apiKey,
    headers: { "HTTP-Referer": "https://github.com/fawwaz/sufra", "X-Title": "Sufra" }
  })
  // The SOURCE is what the Member gave us (ADR 0019): a photo (userText is extra context) or, with no
  // photo, the userText description alone — the message simply carries no image part.
  const source: Source = input.photo === undefined ? "text" : "photo"
  return generateText({
    model: client(input.modelId),
    output: Output.object({
      schema: jsonSchema(ANALYSIS_JSON_SCHEMA as Parameters<typeof jsonSchema>[0])
    }),
    system: getSystemPrompt(input.locale ?? "en", source),
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: buildUserPromptText({ userText: input.userText, source }) },
          ...(input.photo === undefined ? [] : [{ type: "image" as const, image: input.photo }])
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

/** The Estimate's SOURCE material (ADR 0019): what the Member gave us — a photo (the original door) or
 *  a text description (the second door). Decides the prompt framing + the message shape, nothing else:
 *  identification/estimation/clarification/locale rules are shared, so the two sources can't drift. */
export type Source = "photo" | "text"

// The per-source prompt fragments. The photo assembly below is BYTE-IDENTICAL to the pre-ADR-0019
// prompt — the published eval results (and their pinned accuracy numbers) are measured against it.
const FRAMING: Record<Source, string> = {
  photo: "The user has photographed a meal. Your job is to identify what's in the photo and estimate nutritional content.",
  text: "The user has described a meal in text — there is no photo. Your job is to identify what they ate and estimate nutritional content from the description alone."
}

const FOODS_BREAKDOWN: Record<Source, string> = {
  photo: "Per-food `foods[].name` lists each visible item/ingredient. For a single-dish photo this may be one entry matching dishName; for mixed plates it's the breakdown.",
  text: "Per-food `foods[].name` lists each item/ingredient the description mentions. For a single dish this may be one entry matching dishName; for mixed plates it's the breakdown."
}

const NOT_ANALYZABLE: Record<Source, string> = {
  photo: `Non-food / unanalyzable photos:
- If the photo is not of food, is too blurry/dark to analyze, or you genuinely cannot identify what's in it, set notAnalyzable = true and explain briefly in notAnalyzableReason (one short sentence the user will see). Leave foods empty and dishName as an empty string. Do not invent food.
- If you CAN analyze it, set notAnalyzable = false and leave notAnalyzableReason as an empty string.`,
  text: `Non-food / unanalyzable descriptions:
- If the text does not describe food, or is too vague to identify anything edible, set notAnalyzable = true and explain briefly in notAnalyzableReason (one short sentence the user will see). Leave foods empty and dishName as an empty string. Do not invent food.
- If you CAN analyze it, set notAnalyzable = false and leave notAnalyzableReason as an empty string.`
}

// Text descriptions often omit quantities — the dominant error source (portion) needs an explicit rule.
const TEXT_PORTION_RULE =
  "\n- The description may omit quantities. When it does, assume typical single-serving portions for the dish, mark the affected confidence medium or low, and surface portion Clarifications."

const buildSystemPrompt = (source: Source): string => `You are a nutrition estimation model for a calorie-tracking app called Sufra. ${FRAMING[source]}

Identification rules:
- Always give the meal a \`dishName\`: your best guess at what a human would call this thing. Single dishes get the dish name ("Kabsa", "Big Mac", "Caesar salad"); mixed plates get a natural short description ("Fruit and grain breakfast plate", "Mezze platter").
- Name dishes specifically using their cultural names when applicable. Middle Eastern, Levantine, Gulf, and North African cuisine in particular: use names like "kabsa", "mansaf", "fattoush", "tabbouleh", "koshari", "mujadara", "shakshuka", "hummus", "falafel", "manakish", "kibbeh" — not generic descriptions like "rice with chicken" or "chickpea spread".
- For Western and other dishes, name them specifically too (e.g. "Big Mac", "California roll", "carbonara") when recognizable.
- ${FOODS_BREAKDOWN[source]}

${NOT_ANALYZABLE[source]}

Estimation rules (when analyzable):
- For each food, output portionGrams (mass in grams). Also output portionEstimate + portionUnit for human-readable display (e.g. 4 + "pieces", 200 + "g").
- For each food, output estimatedKcal/protein/carbs/fat for THAT food alone. The meal's totals are computed downstream as the sum of these per-food values — do not output a separate total.
- Be honest about confidence. If portion is ambiguous, mark food + overall confidence as medium or low.${source === "text" ? TEXT_PORTION_RULE : ""}

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

const SYSTEM_PROMPTS: Record<Source, string> = {
  photo: buildSystemPrompt("photo"),
  text: buildSystemPrompt("text")
}

export const getSystemPrompt = (locale: Locale = "en", source: Source = "photo"): string => {
  const base = SYSTEM_PROMPTS[source]
  if (locale === "en") return base
  const name = LOCALE_NAMES[locale] ?? locale
  return `${base}\n\n=== Locale ===\nUser's locale is ${name} (${locale}). Output the user-read fields listed above in ${name}. Everything else stays English. Numbers stay Western (0-9).`
}

// User-message builder. Always English (the model is told to localize the OUTPUT fields, not its own
// framing). Single-pass — no clarification round-trip in v1. For the text source the userText IS the
// meal (the description); for the photo source it is extra context.
export const buildUserPromptText = (parts: { readonly userText?: string; readonly source?: Source }): string => {
  const text = parts.userText?.trim()
  if ((parts.source ?? "photo") === "text") {
    return `Estimate this meal from the user's description.\n\nDescription: ${text ?? ""}`
  }
  const sections: string[] = ["Analyze this meal photo."]
  if (text) {
    sections.push(`Additional context from the user: ${text}`)
  }
  return sections.join("\n\n")
}
