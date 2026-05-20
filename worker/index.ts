import { count, eq } from "drizzle-orm"
import { Hono } from "hono"

import { createAuth } from "./auth"
import { createDb } from "./db"
import { appSettings, user } from "./db/schema"
import { createMealsModule, MAX_IMAGE_BYTES } from "./meals"

interface AppEnv extends Env {
  OPENROUTER_API_KEY: string
}

type AuthedSession = { user: { id: string } }

const app = new Hono<{
  Bindings: AppEnv
  Variables: { session: AuthedSession }
}>()
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

  .use("/api/meals/*", async (c, next) => {
    const auth = createAuth(c.env)
    const session = await auth.api.getSession({ headers: c.req.raw.headers })
    if (!session) return c.json({ error: "unauthorized" }, 401)
    c.set("session", session)
    await next()
  })

  .get("/api/meals", async (c) => {
    const from = c.req.query("from")
    const to = c.req.query("to")
    if (!from || !to) return c.json({ error: "missing_range" }, 400)

    const meals = createMealsModule(c.env)
    const items = await meals.list({
      memberId: c.var.session.user.id,
      from,
      to,
    })
    return c.json({ meals: items })
  })

  .post("/api/meals", async (c) => {
    const form = await c.req.formData()
    const file = form.get("photo")
    if (!(file instanceof File)) {
      return c.json({ error: "missing_photo" }, 400)
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return c.json({ error: "photo_too_large" }, 413)
    }

    const meals = createMealsModule(c.env)
    const created = await meals.create({
      memberId: c.var.session.user.id,
      photo: new Uint8Array(await file.arrayBuffer()),
      contentType: file.type || "image/jpeg",
    })
    return c.json(created)
  })

  .get("/api/meals/:id", async (c) => {
    const meals = createMealsModule(c.env)
    const item = await meals.get({
      id: c.req.param("id"),
      memberId: c.var.session.user.id,
    })
    if (!item) return c.json({ error: "not_found" }, 404)
    return c.json(item)
  })

  .post("/api/meals/:id/refine", async (c) => {
    const body = await c.req.json<{ userText?: string }>()
    const userText = body.userText?.trim()
    if (!userText) return c.json({ error: "missing_user_text" }, 400)

    const meals = createMealsModule(c.env)
    const result = await meals.refine({
      id: c.req.param("id"),
      memberId: c.var.session.user.id,
      userText,
    })
    if (result.ok) return c.json({ ok: true, aiAnalysis: result.meal.aiAnalysis })
    return c.json({ error: result.error }, 404)
  })

  .patch("/api/meals/:id/override", async (c) => {
    const patch = await c.req.json<{
      kcal?: number | null
      proteinG?: number | null
      carbsG?: number | null
      fatG?: number | null
    }>()

    const meals = createMealsModule(c.env)
    const result = await meals.setOverride({
      id: c.req.param("id"),
      memberId: c.var.session.user.id,
      patch,
    })
    if (result.ok) return c.json({ ok: true, override: result.meal.override })
    return c.json({ error: result.error }, 404)
  })

  .get("/api/meals/:id/photo", async (c) => {
    const meals = createMealsModule(c.env)
    const obj = await meals.streamPhoto({
      id: c.req.param("id"),
      memberId: c.var.session.user.id,
    })
    if (!obj) return c.json({ error: "not_found" }, 404)

    return new Response(obj.body, {
      headers: {
        "content-type": obj.httpMetadata?.contentType ?? "image/jpeg",
        "cache-control": "private, max-age=31536000, immutable",
        etag: obj.httpEtag,
      },
    })
  })

  .get("/api/_dev/db-check", async (c) => {
    const db = createDb(c.env.DB)
    const [row] = await db.select({ users: count() }).from(user)
    return c.json({ users: row?.users ?? 0 })
  })

  .all("*", (c) => c.env.ASSETS.fetch(c.req.raw))

export type AppType = typeof app

export default app
