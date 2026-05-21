import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import { z } from "zod"

import { requireMember } from "../auth/middleware"
import { apiError, onInvalidInput } from "../errors"
import { createProfileModule } from "../profile/operations"
import type { AppEnvCtx } from "../types"

export const profileRouter = new Hono<AppEnvCtx>()
  .use("/profile", requireMember)
  .use("/onboarding", requireMember)

  // Returns the Member's full Profile snapshot timeline plus the canonical
  // `isOnboarded` flag derived server-side. The client picks which snapshot
  // applies to which day; the gate reads `isOnboarded`.
  .get("/profile", async (c) => {
    const profile = createProfileModule(c.env)
    const data = await profile.getHistory(c.var.session.user.id)
    return c.json(data)
  })

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
      const profile = createProfileModule(c.env)
      const result = await profile.onboard(
        c.var.session.user.id,
        c.req.valid("json")
      )
      if (!result.ok) return apiError(c, 409, result.error)
      return c.json({ profile: result.profile })
    }
  )

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
      const profile = createProfileModule(c.env)
      const result = await profile.edit(
        c.var.session.user.id,
        c.req.valid("json")
      )
      if (!result.ok) return apiError(c, 404, result.error)
      return c.json({ profile: result.profile })
    }
  )
