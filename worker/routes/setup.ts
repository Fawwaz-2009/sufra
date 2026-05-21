import { zValidator } from "@hono/zod-validator"
import { count, eq } from "drizzle-orm"
import { Hono } from "hono"
import { z } from "zod"

import { createAuth } from "../auth"
import { loadValidLink } from "../auth/password-link"
import { createDb } from "../db"
import { appSettings, passwordLink, user } from "../db/schema"
import { apiError, ERROR_CODES, onInvalidInput } from "../errors"
import { DEFAULT_VISION_MODEL_ID } from "../meals"
import type { AppEnvCtx } from "../types"

export const setupRouter = new Hono<AppEnvCtx>()
  .post(
    "/setup",
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

  .get("/set-password/:token", async (c) => {
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
    "/set-password/:token",
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
