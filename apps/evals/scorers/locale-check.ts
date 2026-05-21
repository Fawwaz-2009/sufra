import { parseOutput } from "./_parse.js"

// Verifies that user-read fields are written in the requested locale's script.
// Skips silently when locale=en (the default) — only fires when the test row
// explicitly sets a non-English locale.
//
// Detection is regex-based on Unicode script ranges. We're not asking "is this
// grammatically correct Arabic" — just "does the model honor the locale
// instruction at all". A more sophisticated check could plug in later.

const SCRIPT_RANGES: Record<string, RegExp> = {
  ar: /[\u0600-\u06FF]/,  // Arabic
  fa: /[\u0600-\u06FF]/,  // Persian (shares block with Arabic)
  ur: /[\u0600-\u06FF]/,  // Urdu (shares block with Arabic)
  // For Latin-script languages (fr, es, de, etc.) we'd need a different
  // signal — skip locale-check for those for now and trust the model.
}

type Vars = { locale?: string }
type Output = {
  dishName?: string
  foods?: Array<{ name?: string }>
  clarifications?: Array<{ question?: string }>
  notAnalyzableReason?: string
}

export default function localeCheck(
  output: unknown,
  context: { test: { vars: Vars } },
) {
  const locale = context.test.vars.locale ?? "en"
  if (locale === "en") return { pass: true, score: 1, reason: "locale=en, no check" }

  const range = SCRIPT_RANGES[locale]
  if (!range) {
    return { pass: true, score: 1, reason: `no script regex for locale=${locale}, skipping` }
  }

  const a = parseOutput(output) as Output
  const samples: string[] = []
  if (a.dishName) samples.push(a.dishName)
  for (const f of a.foods ?? []) if (f.name) samples.push(f.name)
  for (const c of a.clarifications ?? []) if (c.question) samples.push(c.question)
  if (a.notAnalyzableReason) samples.push(a.notAnalyzableReason)

  if (samples.length === 0) {
    return { pass: true, score: 1, reason: "no user-read fields to check" }
  }

  const matches = samples.filter((s) => range.test(s)).length
  const ratio = matches / samples.length
  return {
    pass: ratio >= 0.8,
    score: ratio,
    reason: `${matches}/${samples.length} user-read fields contain ${locale}-script characters`,
  }
}
