import { and, asc, count, eq, gte, lt } from "drizzle-orm"
import { Hono } from "hono"

import { createAuth } from "./auth"
import { createDb } from "./db"
import { appSettings, meal, user } from "./db/schema"
import {
  createOpenRouterProvider,
  MAX_IMAGE_BYTES,
} from "./meal-analysis"

interface AppEnv extends Env {
  OPENROUTER_API_KEY: string
}

const app = new Hono<{ Bindings: AppEnv }>()
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

  .get("/api/meals", async (c) => {
    const auth = createAuth(c.env)
    const session = await auth.api.getSession({ headers: c.req.raw.headers })
    if (!session) return c.json({ error: "unauthorized" }, 401)

    const from = c.req.query("from")
    const to = c.req.query("to")
    if (!from || !to) return c.json({ error: "missing_range" }, 400)

    const db = createDb(c.env.DB)
    const rows = await db
      .select()
      .from(meal)
      .where(
        and(
          eq(meal.userId, session.user.id),
          gte(meal.capturedAt, from),
          lt(meal.capturedAt, to)
        )
      )
      .orderBy(asc(meal.capturedAt))

    const meals = rows.map((r) => {
      const base = {
        id: r.id,
        capturedAt: r.capturedAt,
        photoR2Key: r.photoR2Key,
        analysisStatus: r.analysisStatus,
        analysisError: r.analysisError,
      }
      if (r.analysisStatus !== "analyzed" || !r.aiAnalysis) {
        return { ...base, dishName: null, overallConfidence: null, totals: null }
      }
      const foods = r.aiAnalysis.foods
      const sum = (k: "estimatedKcal" | "estimatedProteinG" | "estimatedCarbsG" | "estimatedFatG") =>
        foods.reduce((acc, f) => acc + f[k], 0)
      const override = r.override ?? {}
      return {
        ...base,
        dishName: r.aiAnalysis.dishName,
        overallConfidence: r.aiAnalysis.overallConfidence,
        totals: {
          kcal: override.kcal ?? sum("estimatedKcal"),
          proteinG: override.proteinG ?? sum("estimatedProteinG"),
          carbsG: override.carbsG ?? sum("estimatedCarbsG"),
          fatG: override.fatG ?? sum("estimatedFatG"),
        },
      }
    })

    return c.json({ meals })
  })

  .post("/api/meals", async (c) => {
    const auth = createAuth(c.env)
    const session = await auth.api.getSession({ headers: c.req.raw.headers })
    if (!session) return c.json({ error: "unauthorized" }, 401)

    const form = await c.req.formData()
    const file = form.get("photo")
    if (!(file instanceof File)) {
      return c.json({ error: "missing_photo" }, 400)
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return c.json({ error: "photo_too_large" }, 413)
    }

    const buf = new Uint8Array(await file.arrayBuffer())
    const contentType = file.type || "image/jpeg"

    const mealId = crypto.randomUUID()
    const userId = session.user.id
    const photoKey = `meals/${userId}/${mealId}.jpg`
    const now = new Date()

    await c.env.BUCKET.put(photoKey, buf, {
      httpMetadata: { contentType },
    })

    const db = createDb(c.env.DB)
    await db.insert(meal).values({
      id: mealId,
      userId,
      capturedAt: now.toISOString(),
      photoR2Key: photoKey,
      analysisStatus: "pending",
      createdAt: now,
    })

    c.executionCtx.waitUntil(
      analyzeMealBackground({ env: c.env, mealId, photo: buf })
    )

    return c.json({
      id: mealId,
      capturedAt: now.toISOString(),
      analysisStatus: "pending" as const,
    })
  })

  .get("/api/meals/:id", async (c) => {
    const auth = createAuth(c.env)
    const session = await auth.api.getSession({ headers: c.req.raw.headers })
    if (!session) return c.json({ error: "unauthorized" }, 401)

    const id = c.req.param("id")
    const db = createDb(c.env.DB)
    const [row] = await db.select().from(meal).where(eq(meal.id, id))
    if (!row || row.userId !== session.user.id) {
      return c.json({ error: "not_found" }, 404)
    }

    return c.json({
      id: row.id,
      capturedAt: row.capturedAt,
      analysisStatus: row.analysisStatus,
      analysisError: row.analysisError,
      aiAnalysis: row.aiAnalysis,
      override: row.override,
    })
  })

  .post("/api/meals/:id/refine", async (c) => {
    const auth = createAuth(c.env)
    const session = await auth.api.getSession({ headers: c.req.raw.headers })
    if (!session) return c.json({ error: "unauthorized" }, 401)

    const id = c.req.param("id")
    const body = await c.req.json<{ userText?: string }>()
    const userText = body.userText?.trim()
    if (!userText) return c.json({ error: "missing_user_text" }, 400)

    const db = createDb(c.env.DB)
    const [row] = await db.select().from(meal).where(eq(meal.id, id))
    if (!row || row.userId !== session.user.id) {
      return c.json({ error: "not_found" }, 404)
    }
    if (row.analysisStatus !== "analyzed") {
      return c.json({ error: "not_analyzed" }, 400)
    }

    const obj = await c.env.BUCKET.get(row.photoR2Key)
    if (!obj) return c.json({ error: "photo_missing" }, 404)
    const photo = new Uint8Array(await obj.arrayBuffer())

    const [settings] = await db.select().from(appSettings).limit(1)
    const provider = createOpenRouterProvider({
      apiKey: c.env.OPENROUTER_API_KEY,
    })

    try {
      const result = await provider.analyzeMeal({
        image: photo,
        modelId: settings?.visionModelId,
        locale: "en",
        userText,
      })
      const newKcalSum = result.analysis.foods.reduce(
        (acc, f) => acc + f.estimatedKcal,
        0
      )
      const newKcalTotal = row.override?.kcal ?? newKcalSum

      await db
        .update(meal)
        .set({ aiAnalysis: result.analysis, kcalTotal: newKcalTotal })
        .where(eq(meal.id, id))

      return c.json({ ok: true, aiAnalysis: result.analysis })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return c.json({ error: "refine_failed", message: msg }, 502)
    }
  })

  .patch("/api/meals/:id/override", async (c) => {
    const auth = createAuth(c.env)
    const session = await auth.api.getSession({ headers: c.req.raw.headers })
    if (!session) return c.json({ error: "unauthorized" }, 401)

    const id = c.req.param("id")
    const body = await c.req.json<{
      kcal?: number | null
      proteinG?: number | null
      carbsG?: number | null
      fatG?: number | null
    }>()

    const db = createDb(c.env.DB)
    const [row] = await db.select().from(meal).where(eq(meal.id, id))
    if (!row || row.userId !== session.user.id) {
      return c.json({ error: "not_found" }, 404)
    }
    if (row.analysisStatus !== "analyzed" || !row.aiAnalysis) {
      return c.json({ error: "not_analyzed" }, 400)
    }

    const existing = row.override ?? {}
    const next: Record<string, number | undefined> = { ...existing }
    for (const k of ["kcal", "proteinG", "carbsG", "fatG"] as const) {
      if (k in body) {
        const v = body[k]
        if (v === null || v === undefined) delete next[k]
        else if (typeof v === "number" && Number.isFinite(v) && v >= 0)
          next[k] = v
      }
    }

    const cleaned = Object.keys(next).length > 0 ? next : null
    const aiKcalSum = row.aiAnalysis.foods.reduce(
      (acc, f) => acc + f.estimatedKcal,
      0
    )
    const newKcalTotal = cleaned?.kcal ?? aiKcalSum

    await db
      .update(meal)
      .set({ override: cleaned, kcalTotal: newKcalTotal })
      .where(eq(meal.id, id))

    return c.json({ ok: true, override: cleaned })
  })

  .get("/api/meals/:id/photo", async (c) => {
    const auth = createAuth(c.env)
    const session = await auth.api.getSession({ headers: c.req.raw.headers })
    if (!session) return c.json({ error: "unauthorized" }, 401)

    const id = c.req.param("id")
    const db = createDb(c.env.DB)
    const [row] = await db
      .select({ photoR2Key: meal.photoR2Key, userId: meal.userId })
      .from(meal)
      .where(eq(meal.id, id))
    if (!row || row.userId !== session.user.id) {
      return c.json({ error: "not_found" }, 404)
    }

    const obj = await c.env.BUCKET.get(row.photoR2Key)
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

async function analyzeMealBackground(args: {
  env: AppEnv
  mealId: string
  photo: Uint8Array
}) {
  const db = createDb(args.env.DB)
  try {
    const [settings] = await db.select().from(appSettings).limit(1)
    const provider = createOpenRouterProvider({
      apiKey: args.env.OPENROUTER_API_KEY,
    })
    // TODO swap locale to userProfile.language once onboarding lands.
    const result = await provider.analyzeMeal({
      image: args.photo,
      modelId: settings?.visionModelId,
      locale: "en",
    })

    const kcalTotal = result.analysis.foods.reduce(
      (acc, f) => acc + f.estimatedKcal,
      0
    )

    await db
      .update(meal)
      .set({
        aiAnalysis: result.analysis,
        kcalTotal,
        analysisStatus: "analyzed",
      })
      .where(eq(meal.id, args.mealId))
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await db
      .update(meal)
      .set({ analysisStatus: "failed", analysisError: msg })
      .where(eq(meal.id, args.mealId))
  }
}
