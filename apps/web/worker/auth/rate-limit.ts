import { sql } from "drizzle-orm"

import { createDb } from "../db"
import { rateLimit } from "../db/schema"

type Db = ReturnType<typeof createDb>

export type RateLimitResult = {
  allowed: boolean
  count: number
  limit: number
  resetAt: number
}

// Fixed-window counter in D1. Bucket key = `<scope>:<identifier>:<windowStart>`,
// where windowStart is the unix-ms epoch floored to the window size — so each
// caller gets a fresh bucket every windowMs. Atomic via UPSERT-with-increment;
// over-the-limit attempts still increment (deliberate — otherwise an attacker
// can keep hammering once they're already throttled).
//
// Fail-open on D1 errors. The rate limiter is a defensive cap on OpenRouter
// spend, not a correctness boundary — a transient D1 hiccup blocking a
// legitimate Member from logging a meal is a worse outcome than letting one
// extra meal slip through. Errors are logged for inspection; if they become
// chronic we'll see them in Cloudflare logs and can react. See the
// 2026-05-22 prod incident for the precipitating case (a single user got
// stuck at 500-during-capture because of a transient upsert failure that
// went away on retry).
export async function incrementRateLimit(args: {
  db: Db
  scope: string
  identifier: string
  limit: number
  windowMs: number
}): Promise<RateLimitResult> {
  const now = Date.now()
  const windowStart = Math.floor(now / args.windowMs) * args.windowMs
  const bucketKey = `${args.scope}:${args.identifier}:${windowStart}`
  const expiresAt = new Date(windowStart + args.windowMs)
  const resetAt = windowStart + args.windowMs

  try {
    const [row] = await args.db
      .insert(rateLimit)
      .values({ bucketKey, count: 1, expiresAt })
      .onConflictDoUpdate({
        target: rateLimit.bucketKey,
        set: { count: sql`${rateLimit.count} + 1` },
      })
      .returning({ count: rateLimit.count })

    const count = row?.count ?? 1
    return {
      allowed: count <= args.limit,
      count,
      limit: args.limit,
      resetAt,
    }
  } catch (err) {
    // Fail-open. Log so we can spot a chronic issue if one emerges.
    console.error("rate-limit upsert failed, allowing request", {
      scope: args.scope,
      identifier: args.identifier,
      error: err instanceof Error ? err.message : String(err),
    })
    return {
      allowed: true,
      count: 0,
      limit: args.limit,
      resetAt,
    }
  }
}

export const AI_DAILY_LIMIT = 50
export const DAY_MS = 24 * 60 * 60 * 1000
