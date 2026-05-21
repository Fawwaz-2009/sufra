import { zValidator } from "@hono/zod-validator"
import { and, count, eq, gte, lt, sum } from "drizzle-orm"
import { Hono } from "hono"
import { z } from "zod"

import { createAuth } from "../auth"
import { requireHost } from "../auth/middleware"
import { upsertPasswordLink } from "../auth/password-link"
import { createDb } from "../db"
import { appSettings, inferenceRun, user } from "../db/schema"
import { apiError, ERROR_CODES, onInvalidInput } from "../errors"
import { MODELS } from "../meals"
import type { AppEnvCtx } from "../types"

export const adminRouter = new Hono<AppEnvCtx>()
  .use("*", requireHost)

  .get(
    "/inference-cost",
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

  .get("/settings", async (c) => {
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
    "/settings",
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

  .get("/members", async (c) => {
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
    "/members",
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

  .post("/members/:id/password-link", async (c) => {
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

  .delete("/members/:id", async (c) => {
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
