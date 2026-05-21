import { Hono } from "hono"

import { createAuth } from "../auth"
import type { AppEnvCtx } from "../types"

export const authRouter = new Hono<AppEnvCtx>().on(
  ["GET", "POST"],
  "/*",
  (c) => {
    const auth = createAuth(c.env)
    return auth.handler(c.req.raw)
  }
)
