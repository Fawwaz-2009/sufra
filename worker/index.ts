import { count, eq } from "drizzle-orm"
import { Hono } from "hono"

import { createAuth } from "./auth"
import { createDb } from "./db"
import { appSettings, user } from "./db/schema"

const app = new Hono<{ Bindings: Env }>()
  .get("/api/health", (c) =>
    c.json({ status: "ok", service: "sufra", time: new Date().toISOString() })
  )

  .on(["GET", "POST"], "/api/auth/*", (c) => {
    const auth = createAuth(c.env)
    return auth.handler(c.req.raw)
  })

  .get("/api/setup/status", async (c) => {
    const db = createDb(c.env.DB)
    const [row] = await db
      .select({ hosts: count() })
      .from(user)
      .where(eq(user.role, "host"))
    return c.json({ needsSetup: (row?.hosts ?? 0) === 0 })
  })

  .post("/api/setup", async (c) => {
    const body = await c.req.json<{ username: string; password: string }>()

    if (
      typeof body?.username !== "string" ||
      typeof body?.password !== "string" ||
      body.username.length < 3 ||
      body.password.length < 8 ||
      !/^[a-zA-Z0-9_]+$/.test(body.username)
    ) {
      return c.json({ error: "invalid_input" }, 400)
    }

    const db = createDb(c.env.DB)
    const [row] = await db
      .select({ hosts: count() })
      .from(user)
      .where(eq(user.role, "host"))
    if ((row?.hosts ?? 0) > 0) {
      return c.json({ error: "already_set_up" }, 403)
    }

    const auth = createAuth(c.env)
    const created = await auth.api.signUpEmail({
      body: {
        email: `${body.username}@sufra.local`,
        password: body.password,
        name: body.username,
        username: body.username,
      },
    })

    await db
      .update(user)
      .set({ role: "host" })
      .where(eq(user.id, created.user.id))

    await db
      .insert(appSettings)
      .values({ id: 1, updatedAt: new Date() })
      .onConflictDoNothing()

    const signIn = await auth.api.signInUsername({
      body: { username: body.username, password: body.password },
      returnHeaders: true,
    })

    for (const [key, value] of signIn.headers.entries()) {
      if (key.toLowerCase() === "set-cookie") {
        c.header("set-cookie", value, { append: true })
      }
    }

    return c.json({ ok: true, userId: created.user.id })
  })

  .get("/api/_dev/db-check", async (c) => {
    const db = createDb(c.env.DB)
    const [row] = await db.select({ users: count() }).from(user)
    return c.json({ users: row?.users ?? 0 })
  })

  .all("*", (c) => c.env.ASSETS.fetch(c.req.raw))

export type AppType = typeof app

export default app
