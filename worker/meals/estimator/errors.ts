// Typed errors the vision module can throw. The route handler maps these to
// HTTP responses (4xx vs 5xx) and user-facing messages. Keeping them here so
// every consumer (worker, eval harness, future Ollama provider) speaks the
// same vocabulary.

export type VisionErrorCode =
  | "image-too-large"
  | "image-invalid"
  | "rate-limited"
  | "provider-error"
  | "schema-parse-failed"
  | "model-unavailable"

export type VisionUsage = {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export class VisionError extends Error {
  readonly code: VisionErrorCode
  readonly cause?: unknown
  // Present when the failure happened AFTER OpenRouter had already billed for
  // tokens — most commonly a schema-parse failure where the model produced
  // output but it didn't match the Zod schema. Callers use this to record an
  // inference_run row with status="failed" so monthly cost reflects reality.
  readonly usage?: VisionUsage
  readonly latencyMs?: number
  constructor(
    code: VisionErrorCode,
    message: string,
    cause?: unknown,
    extras?: { usage?: VisionUsage; latencyMs?: number }
  ) {
    super(message)
    this.name = "VisionError"
    this.code = code
    this.cause = cause
    this.usage = extras?.usage
    this.latencyMs = extras?.latencyMs
  }
}

// Cap to protect host's OpenRouter spend. Most cameras already produce <2MB
// after the PRD's client-side resize step (max 1024px JPEG q85). Anything
// above 4MB means client-side resize was skipped or failed — reject server-side
// rather than spend image tokens on a 12MB iPhone shot.
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024
