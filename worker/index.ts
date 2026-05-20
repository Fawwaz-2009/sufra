import { zValidator } from "@hono/zod-validator"
import { count, eq } from "drizzle-orm"
import { Hono } from "hono"
import { z } from "zod"

import { createAuth } from "./auth"
import { createDb } from "./db"
import { appSettings, user } from "./db/schema"
import { apiError, ERROR_CODES, onInvalidInput } from "./errors"
import { createMealsModule, MAX_IMAGE_BYTES } from "./meals"

interface AppEnv extends Env {
  OPENROUTER_API_KEY: string
}

const MAX_RANGE_MS = 31 * 24 * 60 * 60 * 1000

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

  .post(
    "/api/setup",
    zValidator(
      "json",
      z.object({
        username: z
          .string()
          .min(3, ERROR_CODES.INVALID_USERNAME)
          .regex(/^[a-zA-Z0-9_]+$/, ERROR_CODES.INVALID_USERNAME),
        password: z.string().min(8, ERROR_CODES.INVALID_INPUT),
      }),
      onInvalidInput
    ),
    async (c) => {
      const body = c.req.valid("json")

      const db = createDb(c.env.DB)
      const [row] = await db
        .select({ hosts: count() })
        .from(user)
        .where(eq(user.role, "host"))
      if ((row?.hosts ?? 0) > 0) {
        return apiError(c, 403, ERROR_CODES.ALREADY_SET_UP)
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
    }
  )

  .use("/api/meals/*", async (c, next) => {
    const auth = createAuth(c.env)
    const session = await auth.api.getSession({ headers: c.req.raw.headers })
    if (!session) return apiError(c, 401, ERROR_CODES.UNAUTHORIZED)
    c.set("session", session)
    await next()
  })

  .get(
    "/api/meals",
    zValidator(
      "query",
      z
        .object({
          from: z.iso.datetime({ message: ERROR_CODES.INVALID_RANGE }),
          to: z.iso.datetime({ message: ERROR_CODES.INVALID_RANGE }),
        })
        .refine(
          ({ from, to }) => Date.parse(to) > Date.parse(from),
          ERROR_CODES.INVALID_RANGE
        )
        .refine(
          ({ from, to }) => Date.parse(to) - Date.parse(from) <= MAX_RANGE_MS,
          ERROR_CODES.RANGE_TOO_LARGE
        ),
      onInvalidInput
    ),
    async (c) => {
      const { from, to } = c.req.valid("query")
      const meals = createMealsModule(c.env)
      const items = await meals.list({
        memberId: c.var.session.user.id,
        from,
        to,
      })
      return c.json({ meals: items })
    }
  )

  .post(
    "/api/meals",
    zValidator(
      "form",
      z.object({
        photo: z
          .instanceof(File)
          .refine((f) => f.size <= MAX_IMAGE_BYTES, ERROR_CODES.PHOTO_TOO_LARGE),
        capturedAt: z.iso
          .datetime()
          .refine(
            (s) => Date.parse(s) <= Date.now(),
            ERROR_CODES.CAPTURED_AT_IN_FUTURE
          )
          .optional(),
      }),
      onInvalidInput
    ),
    async (c) => {
      const { photo, capturedAt } = c.req.valid("form")
      const meals = createMealsModule(c.env)
      const created = await meals.create({
        memberId: c.var.session.user.id,
        photo: new Uint8Array(await photo.arrayBuffer()),
        contentType: photo.type || "image/jpeg",
        capturedAt,
      })
      return c.json(created)
    }
  )

  .get("/api/meals/:id", async (c) => {
    const meals = createMealsModule(c.env)
    const item = await meals.get({
      id: c.req.param("id"),
      memberId: c.var.session.user.id,
    })
    if (!item) return apiError(c, 404, ERROR_CODES.NOT_FOUND)
    return c.json(item)
  })

  .post(
    "/api/meals/:id/refine",
    zValidator(
      "json",
      z.object({
        userText: z.string().trim().min(1, ERROR_CODES.MISSING_USER_TEXT),
      }),
      onInvalidInput
    ),
    async (c) => {
      const { userText } = c.req.valid("json")
      const meals = createMealsModule(c.env)
      const result = await meals.refine({
        id: c.req.param("id"),
        memberId: c.var.session.user.id,
        userText,
      })
      if (result.ok)
        return c.json({ ok: true, aiAnalysis: result.meal.aiAnalysis })
      return apiError(c, 404, result.error)
    }
  )

  .patch(
    "/api/meals/:id/override",
    zValidator(
      "json",
      z.object({
        kcal: z.number().nonnegative().nullable().optional(),
        proteinG: z.number().nonnegative().nullable().optional(),
        carbsG: z.number().nonnegative().nullable().optional(),
        fatG: z.number().nonnegative().nullable().optional(),
      }),
      onInvalidInput
    ),
    async (c) => {
      const patch = c.req.valid("json")
      const meals = createMealsModule(c.env)
      const result = await meals.setOverride({
        id: c.req.param("id"),
        memberId: c.var.session.user.id,
        patch,
      })
      if (result.ok) return c.json({ ok: true, override: result.meal.override })
      return apiError(c, 404, result.error)
    }
  )

  .get("/api/meals/:id/photo", async (c) => {
    const meals = createMealsModule(c.env)
    const obj = await meals.streamPhoto({
      id: c.req.param("id"),
      memberId: c.var.session.user.id,
    })
    if (!obj) return apiError(c, 404, ERROR_CODES.NOT_FOUND)

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
