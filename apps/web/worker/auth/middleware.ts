import type { MiddlewareHandler } from "hono"

import { apiError, ERROR_CODES } from "../errors"
import type { AppEnvCtx } from "../types"
import { createAuth } from "./index"

export const requireMember: MiddlewareHandler<AppEnvCtx> = async (c, next) => {
  const auth = createAuth(c.env)
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) return apiError(c, 401, ERROR_CODES.UNAUTHORIZED)
  c.set("session", session)
  await next()
}

export const requireHost: MiddlewareHandler<AppEnvCtx> = async (c, next) => {
  const auth = createAuth(c.env)
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) return apiError(c, 401, ERROR_CODES.UNAUTHORIZED)
  if (session.user.role !== "host") {
    return apiError(c, 403, ERROR_CODES.FORBIDDEN)
  }
  c.set("session", session)
  await next()
}
