import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import { z } from "zod"

import { requireMember } from "../auth/middleware"
import { apiError, ERROR_CODES, onInvalidInput } from "../errors"
import type { AppEnvCtx } from "../types"
import { createWeightsModule } from "../weights/operations"
import {
  weightLogCreateSchema,
  weightLogRangeSchema,
} from "../weights/schema"

export const weightsRouter = new Hono<AppEnvCtx>()
  .use("*", requireMember)

  .get("/", zValidator("query", weightLogRangeSchema, onInvalidInput), async (c) => {
    const { from, to } = c.req.valid("query")
    const weights = createWeightsModule(c.env)
    const items = await weights.list({
      memberId: c.var.session.user.id,
      from,
      to,
    })
    return c.json({ weights: items })
  })

  .post(
    "/",
    zValidator("json", weightLogCreateSchema, onInvalidInput),
    async (c) => {
      const weights = createWeightsModule(c.env)
      const result = await weights.create(
        c.var.session.user.id,
        c.req.valid("json")
      )
      if (!result.ok) return apiError(c, 404, result.error)
      return c.json({ weight: result.weight })
    }
  )

  .delete(
    "/:id",
    zValidator(
      "param",
      z.object({
        id: z.coerce.number().int().positive(ERROR_CODES.NOT_FOUND),
      }),
      onInvalidInput
    ),
    async (c) => {
      const { id } = c.req.valid("param")
      const weights = createWeightsModule(c.env)
      const result = await weights.delete({
        id,
        memberId: c.var.session.user.id,
      })
      if (!result.ok) return apiError(c, 404, result.error)
      return c.json({ ok: true })
    }
  )
