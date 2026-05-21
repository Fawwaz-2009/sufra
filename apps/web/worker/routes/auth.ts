import { Hono } from "hono"

import { createAuth } from "../auth"
import { apiError, ERROR_CODES } from "../errors"
import type { AppEnvCtx } from "../types"

// Paths better-auth exposes for credential sign-in. Throttled per IP via the
// Workers Rate Limiting binding to defang brute-force / credential stuffing.
const SIGN_IN_PATHS = new Set(["/sign-in/username", "/sign-in/email"])

export const authRouter = new Hono<AppEnvCtx>().on(
  ["GET", "POST"],
  "/*",
  async (c) => {
    if (c.req.method === "POST") {
      const subpath = new URL(c.req.url).pathname.replace(/^\/api\/auth/, "")
      if (SIGN_IN_PATHS.has(subpath)) {
        // `cf-connecting-ip` is always set by Cloudflare in front of the
        // Worker. Missing means we're in local dev (workerd) — fall back to a
        // shared bucket so the limiter is still exercised in tests.
        const ip = c.req.header("cf-connecting-ip") ?? "local-dev"
        const { success } = await c.env.LOGIN_RATE_LIMITER.limit({ key: ip })
        if (!success) {
          return apiError(c, 429, ERROR_CODES.TOO_MANY_REQUESTS)
        }
      }
    }
    const auth = createAuth(c.env)
    return auth.handler(c.req.raw)
  }
)
