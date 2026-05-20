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

export class VisionError extends Error {
  readonly code: VisionErrorCode
  readonly cause?: unknown
  constructor(code: VisionErrorCode, message: string, cause?: unknown) {
    super(message)
    this.name = "VisionError"
    this.code = code
    this.cause = cause
  }
}

// Cap to protect host's OpenRouter spend. Most cameras already produce <2MB
// after the PRD's client-side resize step (max 1024px JPEG q85). Anything
// above 4MB means client-side resize was skipped or failed — reject server-side
// rather than spend image tokens on a 12MB iPhone shot.
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024
