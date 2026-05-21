import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"

import { requireMember } from "../auth/middleware"
import { apiError, onInvalidInput } from "../errors"
import { createProfileModule } from "../profile/operations"
import {
  profileEditSchema,
  profileOnboardSchema,
} from "../profile/schema"
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
    zValidator("json", profileOnboardSchema, onInvalidInput),
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
    zValidator("json", profileEditSchema, onInvalidInput),
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
