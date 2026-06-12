import { describe, expect, it } from "vitest"
import { getSystemPrompt } from "../../../src/worker/domain/meal/estimatable/vision.ts"

/**
 * The Locale allowlist (ADR 0020). The locale is a RAW CLIENT STRING by design (the wire stays
 * additive — ADR 0018), so the prompt builder is the allowlist: a known locale appends the Locale
 * section; anything else falls back to the plain English prompt, never interpolated.
 */
describe("getSystemPrompt locale allowlist", () => {
  it("returns the bare prompt for en", () => {
    expect(getSystemPrompt("en", "photo")).not.toContain("=== Locale ===")
  })

  it("appends the Locale section for an allowlisted locale", () => {
    const prompt = getSystemPrompt("ar", "photo")
    expect(prompt).toContain("=== Locale ===")
    expect(prompt).toContain("Arabic (ar)")
    // The locale suffix is an APPEND — the eval-pinned photo prompt stays byte-identical underneath.
    expect(prompt.startsWith(getSystemPrompt("en", "photo"))).toBe(true)
  })

  it("falls back to English for an unknown locale — the raw string never reaches the prompt", () => {
    const prompt = getSystemPrompt("zz-injected", "photo")
    expect(prompt).toBe(getSystemPrompt("en", "photo"))
    expect(prompt).not.toContain("zz-injected")
  })
})
