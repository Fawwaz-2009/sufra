// Promptfoo passes `output` as either a string (when response_format is plain
// text) or an already-parsed object (when json_schema is enforced). Handle
// both. Also strips markdown code fences if a model returned ```json …```.
export function parseOutput(output: unknown): unknown {
  if (output && typeof output === "object") return output
  if (typeof output !== "string") return output
  const stripped = output
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
  try {
    return JSON.parse(stripped)
  } catch {
    return JSON.parse(output)
  }
}
