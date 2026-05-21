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
    resetAt: windowStart + args.windowMs,
  }
}

export const AI_DAILY_LIMIT = 50
export const DAY_MS = 24 * 60 * 60 * 1000
