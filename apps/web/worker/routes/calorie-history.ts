import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"

import { requireMember } from "../auth/middleware"
import { calorieHistoryRangeSchema } from "../calorie-history/schema"
import { createCalorieHistoryModule } from "../calorie-history/operations"
import { onInvalidInput } from "../errors"
import type { AppEnvCtx } from "../types"

export const calorieHistoryRouter = new Hono<AppEnvCtx>()
  .use("*", requireMember)

  .get(
    "/",
    zValidator("query", calorieHistoryRangeSchema, onInvalidInput),
    async (c) => {
      const history = createCalorieHistoryModule(c.env)
      const buckets = await history.list({
        memberId: c.var.session.user.id,
        input: c.req.valid("query"),
      })
      return c.json({ buckets })
    }
  )
