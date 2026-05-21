import { zValidator } from "@hono/zod-validator"
import { and, desc, eq } from "drizzle-orm"
import { Hono } from "hono"
import { z } from "zod"

import { requireMember } from "../auth/middleware"
import { createDb } from "../db"
import { profileLog, weightLog } from "../db/schema"
import { apiError, ERROR_CODES, onInvalidInput } from "../errors"
import type { AppEnvCtx } from "../types"

export const profileRouter = new Hono<AppEnvCtx>()
  .use("/profile", requireMember)
  .use("/onboarding", requireMember)

  // Append a Member's initial Profile snapshot. The first row in profile_log
  // takes effect immediately (effective_from = today_local) — Onboarding is
  // the one Profile write that doesn't follow the "starts tomorrow" rule (see
  // ADR 0002). Idempotency: if profile_log already has a row for this user,
  // we return 409 — Onboarding is one-shot.
  .post(
    "/onboarding",
    zValidator(
      "json",
      z.object({
        sex: z.enum(["male", "female"]),
        birthday: z.iso.date(),
        heightCm: z.number().int().min(100).max(250),
        displayHeightUnit: z.enum(["cm", "imperial"]).default("cm"),
        weightKg: z.number().min(30).max(300),
        displayWeightUnit: z.enum(["kg", "lb"]).default("kg"),
        activityLevel: z.enum(["sedentary", "light", "moderate", "active"]),
        goalWeightKg: z.number().min(30).max(300),
        weeklyRateKg: z.number().min(0).max(2),
        todayLocalDate: z.iso.date(),
      }),
      onInvalidInput
    ),
    async (c) => {
      const body = c.req.valid("json")
      const userId = c.var.session.user.id
      const db = createDb(c.env.DB)

      const [existing] = await db
        .select({ id: profileLog.id })
        .from(profileLog)
        .where(eq(profileLog.userId, userId))
        .limit(1)
      if (existing) return apiError(c, 409, ERROR_CODES.ALREADY_ONBOARDED)

      const now = new Date()
      const id = crypto.randomUUID()

      await db.insert(profileLog).values({
        id,
        userId,
        effectiveFrom: body.todayLocalDate,
        createdAt: now,
        sex: body.sex,
        birthday: body.birthday,
        heightCm: body.heightCm,
        displayHeightUnit: body.displayHeightUnit,
        weightKg: body.weightKg,
        displayWeightUnit: body.displayWeightUnit,
        activityLevel: body.activityLevel,
        goalWeightKg: body.goalWeightKg,
        weeklyRateKg: body.weeklyRateKg,
      })

      await db.insert(weightLog).values({
        userId,
        weightKg: body.weightKg,
        loggedAt: now.toISOString(),
        createdAt: now,
      })

      const [row] = await db
        .select()
        .from(profileLog)
        .where(eq(profileLog.id, id))
      return c.json({ profile: row! })
    }
  )

  // Returns the Member's full Profile snapshot history ordered by
  // effective_from DESC. Tiny payload — typically 1–5 rows. The client picks
  // which row applies to which day:
  //   - "today's profile"        = first row where effective_from <= today_local
  //   - "tomorrow-pending state" = any row where effective_from > today_local
  //   - "past day X's profile"   = first row where effective_from <= local_date(X)
  // Computing this server-side per-day would require N round trips for the
  // week-strip; returning the timeline once keeps it client-side.
  .get("/profile", async (c) => {
    const userId = c.var.session.user.id
    const db = createDb(c.env.DB)
    const rows = await db
      .select()
      .from(profileLog)
      .where(eq(profileLog.userId, userId))
      .orderBy(desc(profileLog.effectiveFrom))
    return c.json({ profiles: rows })
  })

  // Profile edit. Inserts a new profile_log row with effective_from chosen
  // by the client (Member's tomorrow in their current TZ). Unchanged fields
  // are inherited from the latest row. If `weightKg` is present, also
  // appends a weight_log row at logged_at = now (measurement record). The
  // UNIQUE(user_id, effective_from) constraint plus ON CONFLICT UPDATE
  // handles "edited twice in one day" — both writes target the same
  // tomorrow row; second overwrites.
  .patch(
    "/profile",
    zValidator(
      "json",
      z.object({
        sex: z.enum(["male", "female"]).optional(),
        birthday: z.iso.date().optional(),
        heightCm: z.number().int().min(100).max(250).optional(),
        displayHeightUnit: z.enum(["cm", "imperial"]).optional(),
        weightKg: z.number().min(30).max(300).optional(),
        displayWeightUnit: z.enum(["kg", "lb"]).optional(),
        activityLevel: z
          .enum(["sedentary", "light", "moderate", "active"])
          .optional(),
        goalWeightKg: z.number().min(30).max(300).optional(),
        weeklyRateKg: z.number().min(0).max(2).optional(),
        effectiveFrom: z.iso.date(),
      }),
      onInvalidInput
    ),
    async (c) => {
      const body = c.req.valid("json")
      const userId = c.var.session.user.id
      const db = createDb(c.env.DB)

      const [latest] = await db
        .select()
        .from(profileLog)
        .where(eq(profileLog.userId, userId))
        .orderBy(desc(profileLog.effectiveFrom))
        .limit(1)
      if (!latest) return apiError(c, 404, ERROR_CODES.NOT_FOUND)

      const merged = {
        sex: body.sex ?? latest.sex,
        birthday: body.birthday ?? latest.birthday,
        heightCm: body.heightCm ?? latest.heightCm,
        displayHeightUnit: body.displayHeightUnit ?? latest.displayHeightUnit,
        weightKg: body.weightKg ?? latest.weightKg,
        displayWeightUnit: body.displayWeightUnit ?? latest.displayWeightUnit,
        activityLevel: body.activityLevel ?? latest.activityLevel,
        goalWeightKg: body.goalWeightKg ?? latest.goalWeightKg,
        weeklyRateKg: body.weeklyRateKg ?? latest.weeklyRateKg,
      }

      const now = new Date()
      await db
        .insert(profileLog)
        .values({
          id: crypto.randomUUID(),
          userId,
          effectiveFrom: body.effectiveFrom,
          createdAt: now,
          ...merged,
        })
        .onConflictDoUpdate({
          target: [profileLog.userId, profileLog.effectiveFrom],
          set: { ...merged, createdAt: now },
        })

      if (
        body.weightKg !== undefined &&
        body.weightKg !== latest.weightKg
      ) {
        await db.insert(weightLog).values({
          userId,
          weightKg: body.weightKg,
          loggedAt: now.toISOString(),
          createdAt: now,
        })
      }

      const [row] = await db
        .select()
        .from(profileLog)
        .where(
          and(
            eq(profileLog.userId, userId),
            eq(profileLog.effectiveFrom, body.effectiveFrom)
          )
        )
      return c.json({ profile: row! })
    }
  )
