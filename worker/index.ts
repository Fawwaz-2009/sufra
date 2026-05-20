import { zValidator } from "@hono/zod-validator"
import { and, count, eq, gte, lt, sum } from "drizzle-orm"
import { Hono } from "hono"
import { z } from "zod"

import { createAuth } from "./auth"
import { createDb } from "./db"
import {
  appSettings,
  inferenceRun,
  passwordLink,
  user,
} from "./db/schema"
import { apiError, ERROR_CODES, onInvalidInput } from "./errors"
import {
  createMealsModule,
  DEFAULT_VISION_MODEL_ID,
  MAX_IMAGE_BYTES,
  MODELS,
} from "./meals"

interface AppEnv extends Env {
  OPENROUTER_API_KEY: string
}

const MAX_RANGE_MS = 31 * 24 * 60 * 60 * 1000

type AuthedSession = { user: { id: string; role?: string | null } }

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
        familyName: z
          .string()
          .trim()
          .min(1, ERROR_CODES.INVALID_INPUT)
          .max(40, ERROR_CODES.INVALID_INPUT),
        username: z
          .string()
          .min(3, ERROR_CODES.INVALID_USERNAME)
          .regex(/^[a-zA-Z0-9_]+$/, ERROR_CODES.INVALID_USERNAME),
        password: z.string().min(6, ERROR_CODES.INVALID_INPUT),
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

      // Setup is gated on "zero hosts exist", so this row normally doesn't
      // exist yet — but if a stale singleton row is lying around (e.g. local
      // dev where the host got deleted but app_settings persisted), the
      // wizard's input should win, not be silently ignored.
      await db
        .insert(appSettings)
        .values({
          id: 1,
          visionModelId: DEFAULT_VISION_MODEL_ID,
          familyName: body.familyName,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: appSettings.id,
          set: {
            visionModelId: DEFAULT_VISION_MODEL_ID,
            familyName: body.familyName,
            updatedAt: new Date(),
          },
        })

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
          .refine(
            (f) => f.size <= MAX_IMAGE_BYTES,
            ERROR_CODES.PHOTO_TOO_LARGE
          ),
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

  .use("/api/admin/*", async (c, next) => {
    const auth = createAuth(c.env)
    const session = await auth.api.getSession({ headers: c.req.raw.headers })
    if (!session) return apiError(c, 401, ERROR_CODES.UNAUTHORIZED)
    if (session.user.role !== "host") {
      return apiError(c, 403, ERROR_CODES.FORBIDDEN)
    }
    c.set("session", session)
    await next()
  })

  .get(
    "/api/admin/inference-cost",
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
        ),
      onInvalidInput
    ),
    async (c) => {
      const { from, to } = c.req.valid("query")
      const db = createDb(c.env.DB)
      const fromMs = Date.parse(from)
      const toMs = Date.parse(to)
      const [agg] = await db
        .select({
          totalUsd: sum(inferenceRun.costUsd),
          runCount: count(),
        })
        .from(inferenceRun)
        .where(
          and(
            gte(inferenceRun.createdAt, new Date(fromMs)),
            lt(inferenceRun.createdAt, new Date(toMs))
          )
        )
      const [memberAgg] = await db.select({ memberCount: count() }).from(user)
      const totalUsd = Number(agg?.totalUsd ?? 0)
      const runCount = agg?.runCount ?? 0
      const memberCount = memberAgg?.memberCount ?? 1
      const perMemberAvgUsd = memberCount > 0 ? totalUsd / memberCount : 0
      return c.json({ totalUsd, runCount, perMemberAvgUsd, memberCount })
    }
  )

  .get("/api/admin/settings", async (c) => {
    const db = createDb(c.env.DB)
    const [row] = await db
      .select({
        visionModelId: appSettings.visionModelId,
        familyName: appSettings.familyName,
        deficitSafetyWarningEnabled: appSettings.deficitSafetyWarningEnabled,
      })
      .from(appSettings)
      .where(eq(appSettings.id, 1))
    if (!row) return apiError(c, 404, ERROR_CODES.NOT_FOUND)
    return c.json(row)
  })

  .patch(
    "/api/admin/settings",
    zValidator(
      "json",
      z.object({
        visionModelId: z
          .string()
          .refine(
            (id) => MODELS.some((m) => m.id === id),
            ERROR_CODES.INVALID_MODEL
          )
          .optional(),
      }),
      onInvalidInput
    ),
    async (c) => {
      const patch = c.req.valid("json")
      const db = createDb(c.env.DB)
      const updates: Record<string, unknown> = { updatedAt: new Date() }
      if (patch.visionModelId !== undefined) {
        updates.visionModelId = patch.visionModelId
      }
      await db.update(appSettings).set(updates).where(eq(appSettings.id, 1))
      const [row] = await db
        .select({
          visionModelId: appSettings.visionModelId,
          familyName: appSettings.familyName,
          deficitSafetyWarningEnabled: appSettings.deficitSafetyWarningEnabled,
        })
        .from(appSettings)
        .where(eq(appSettings.id, 1))
      return c.json(row!)
    }
  )

  .get("/api/admin/members", async (c) => {
    const db = createDb(c.env.DB)
    const rows = await db
      .select({
        id: user.id,
        username: user.username,
        createdAt: user.createdAt,
      })
      .from(user)
      .where(eq(user.role, "user"))
    return c.json({ members: rows })
  })

  .post(
    "/api/admin/members",
    zValidator(
      "json",
      z.object({
        username: z
          .string()
          .min(3, ERROR_CODES.INVALID_USERNAME)
          .regex(/^[a-zA-Z0-9_]+$/, ERROR_CODES.INVALID_USERNAME),
      }),
      onInvalidInput
    ),
    async (c) => {
      const { username } = c.req.valid("json")
      const db = createDb(c.env.DB)
      const auth = createAuth(c.env)

      const [existing] = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.username, username))
      if (existing) {
        return apiError(c, 409, ERROR_CODES.USERNAME_TAKEN)
      }

      // Generate a throwaway placeholder that will never authenticate — the
      // Member's real password is set later via Password link redemption.
      // better-auth requires a non-null password on signUp; the account row
      // exists from the start but the placeholder hash is unreachable.
      const placeholder = crypto.randomUUID() + crypto.randomUUID()
      const created = await auth.api.signUpEmail({
        body: {
          email: `${username}@sufra.local`,
          password: placeholder,
          name: username,
          username,
        },
      })

      const linkInfo = await upsertPasswordLink({
        db,
        userId: created.user.id,
        createdBy: c.var.session.user.id,
      })

      return c.json({
        member: {
          id: created.user.id,
          username,
          createdAt: created.user.createdAt,
        },
        passwordLink: linkInfo,
      })
    }
  )

  .post("/api/admin/members/:id/password-link", async (c) => {
    const db = createDb(c.env.DB)
    const id = c.req.param("id")
    const [target] = await db
      .select({ id: user.id, role: user.role })
      .from(user)
      .where(eq(user.id, id))
    if (!target || target.role !== "user") {
      return apiError(c, 404, ERROR_CODES.NOT_FOUND)
    }
    const linkInfo = await upsertPasswordLink({
      db,
      userId: id,
      createdBy: c.var.session.user.id,
    })
    return c.json({ passwordLink: linkInfo })
  })

  .delete("/api/admin/members/:id", async (c) => {
    const db = createDb(c.env.DB)
    const id = c.req.param("id")
    const [target] = await db
      .select({ id: user.id, role: user.role })
      .from(user)
      .where(eq(user.id, id))
    if (!target || target.role !== "user") {
      return apiError(c, 404, ERROR_CODES.NOT_FOUND)
    }

    // R2 photos do not cascade from D1 — clean up by listing the member's
    // prefix. The meal rows themselves cascade via the user FK.
    const prefix = `meals/${id}/`
    let cursor: string | undefined
    do {
      const listing = await c.env.BUCKET.list({ prefix, cursor })
      if (listing.objects.length > 0) {
        await c.env.BUCKET.delete(listing.objects.map((o) => o.key))
      }
      cursor = listing.truncated ? listing.cursor : undefined
    } while (cursor)

    await db.delete(user).where(eq(user.id, id))
    return c.json({ ok: true })
  })

  .get("/api/_dev/db-check", async (c) => {
    const db = createDb(c.env.DB)
    const [row] = await db.select({ users: count() }).from(user)
    return c.json({ users: row?.users ?? 0 })
  })

  .get("/api/set-password/:token", async (c) => {
    const db = createDb(c.env.DB)
    const token = c.req.param("token")
    const result = await loadValidLink(db, token)
    if (!result.ok) return apiError(c, 404, result.error)
    return c.json({
      username: result.username,
      familyName: result.familyName,
    })
  })

  .post(
    "/api/set-password/:token",
    zValidator(
      "json",
      z.object({
        password: z.string().min(6, ERROR_CODES.INVALID_INPUT),
      }),
      onInvalidInput
    ),
    async (c) => {
      const db = createDb(c.env.DB)
      const auth = createAuth(c.env)
      const token = c.req.param("token")
      const { password } = c.req.valid("json")

      const result = await loadValidLink(db, token)
      if (!result.ok) return apiError(c, 404, result.error)

      // Overwrite the Member's password. We can't call auth.api.setUserPassword
      // here because that endpoint requires an admin session (adminMiddleware)
      // — but this route is intentionally unauthenticated; possession of the
      // token IS the credential. Drop down to the same primitives the admin
      // endpoint uses internally: hash via the configured scrypt hasher, then
      // updatePassword on the account row directly.
      const authContext = await auth.$context
      const hashed = await authContext.password.hash(password)
      await authContext.internalAdapter.updatePassword(result.userId, hashed)

      await db.delete(passwordLink).where(eq(passwordLink.token, token))

      const signIn = await auth.api.signInUsername({
        body: { username: result.username, password },
        returnHeaders: true,
      })
      for (const [key, value] of signIn.headers.entries()) {
        if (key.toLowerCase() === "set-cookie") {
          c.header("set-cookie", value, { append: true })
        }
      }

      return c.json({ ok: true })
    }
  )

  .all("*", (c) => c.env.ASSETS.fetch(c.req.raw))

export type AppType = typeof app

export default app

const PASSWORD_LINK_TTL_MS = 24 * 60 * 60 * 1000

async function upsertPasswordLink(args: {
  db: ReturnType<typeof createDb>
  userId: string
  createdBy: string
}) {
  const token = generateToken()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + PASSWORD_LINK_TTL_MS)
  await args.db
    .insert(passwordLink)
    .values({
      id: crypto.randomUUID(),
      userId: args.userId,
      token,
      createdBy: args.createdBy,
      createdAt: now,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: passwordLink.userId,
      set: {
        token,
        createdBy: args.createdBy,
        createdAt: now,
        expiresAt,
      },
    })
  return { token, expiresAt: expiresAt.toISOString() }
}

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  // base64url — no padding, URL-safe alphabet.
  let s = ""
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

async function loadValidLink(
  db: ReturnType<typeof createDb>,
  token: string
): Promise<
  | { ok: false; error: string }
  | { ok: true; userId: string; username: string; familyName: string }
> {
  const [link] = await db
    .select({ userId: passwordLink.userId, expiresAt: passwordLink.expiresAt })
    .from(passwordLink)
    .where(eq(passwordLink.token, token))
  if (!link) return { ok: false, error: ERROR_CODES.LINK_INVALID }
  if (link.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: ERROR_CODES.LINK_EXPIRED }
  }
  const [u] = await db
    .select({ username: user.username })
    .from(user)
    .where(eq(user.id, link.userId))
  if (!u?.username) return { ok: false, error: ERROR_CODES.LINK_INVALID }

  const [settings] = await db
    .select({ familyName: appSettings.familyName })
    .from(appSettings)
    .where(eq(appSettings.id, 1))

  return {
    ok: true,
    userId: link.userId,
    username: u.username,
    familyName: settings?.familyName ?? "My",
  }
}
