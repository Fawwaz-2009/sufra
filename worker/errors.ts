import type { Context } from "hono"
import type { ContentfulStatusCode } from "hono/utils/http-status"

export const ERROR_CODES = {
  UNAUTHORIZED: "unauthorized",
  ALREADY_SET_UP: "already_set_up",
  NOT_FOUND: "not_found",
  PHOTO_MISSING: "photo_missing",
  INVALID_INPUT: "invalid_input",
  INVALID_USERNAME: "invalid_username",
  INVALID_RANGE: "invalid_range",
  RANGE_TOO_LARGE: "range_too_large",
  PHOTO_TOO_LARGE: "photo_too_large",
  CAPTURED_AT_IN_FUTURE: "captured_at_in_future",
  MISSING_USER_TEXT: "missing_user_text",
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]

export type ApiErrorBody = { error: string }

export function apiError(
  c: Context,
  status: ContentfulStatusCode,
  code: ErrorCode | string
) {
  return c.json({ error: code } satisfies ApiErrorBody, status)
}

type ValidationResult =
  | { success: true; data: unknown }
  | {
      success: false
      error: { issues: { message: string }[] }
      data: unknown
    }

export function onInvalidInput(result: ValidationResult, c: Context) {
  if (!result.success) {
    return apiError(
      c,
      400,
      result.error.issues[0]?.message ?? ERROR_CODES.INVALID_INPUT
    )
  }
}
