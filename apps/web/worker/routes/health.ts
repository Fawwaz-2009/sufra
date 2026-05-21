import { count, eq } from "drizzle-orm"
import { Hono } from "hono"

import { createDb } from "../db"
import { user } from "../db/schema"
import type { AppEnvCtx } from "../types"

export const healthRouter = new Hono<AppEnvCtx>()
  .get("/health", (c) =>
    c.json({ status: "ok", service: "sufra", time: new Date().toISOString() })
  )
  .get("/setup/status", async (c) => {
    const db = createDb(c.env.DB)
    const [row] = await db
      .select({ hosts: count() })
      .from(user)
      .where(eq(user.role, "host"))
    return c.json({ needsSetup: (row?.hosts ?? 0) === 0 })
  })
  .get("/_dev/db-check", async (c) => {
    const db = createDb(c.env.DB)
    const [row] = await db.select({ users: count() }).from(user)
    return c.json({ users: row?.users ?? 0 })
  })
