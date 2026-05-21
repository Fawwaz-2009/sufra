import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import { z } from "zod"

import { requireMember } from "../auth/middleware"
import { apiError, ERROR_CODES, onInvalidInput } from "../errors"
import { createMealsModule, MAX_IMAGE_BYTES } from "../meals"
import {
  mealOverridePatchSchema,
  mealRefineSchema,
} from "../meals/schema"
import type { AppEnvCtx } from "../types"

const MAX_RANGE_MS = 31 * 24 * 60 * 60 * 1000

export const mealsRouter = new Hono<AppEnvCtx>()
  .use("*", requireMember)

  .get(
    "/",
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
    "/",
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

  .get("/saved", async (c) => {
    const meals = createMealsModule(c.env)
    const items = await meals.listSaved({
      memberId: c.var.session.user.id,
    })
    return c.json({ meals: items })
  })

  .post(
    "/clone",
    zValidator(
      "json",
      z.object({
        sourceMealId: z.string().min(1),
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
      const { sourceMealId, capturedAt } = c.req.valid("json")
      const meals = createMealsModule(c.env)
      const result = await meals.clone({
        memberId: c.var.session.user.id,
        sourceMealId,
        capturedAt,
      })
      if (result.ok) return c.json(result.meal)
      return apiError(c, 404, result.error)
    }
  )

  .get("/:id", async (c) => {
    const meals = createMealsModule(c.env)
    const item = await meals.get({
      id: c.req.param("id"),
      memberId: c.var.session.user.id,
    })
    if (!item) return apiError(c, 404, ERROR_CODES.NOT_FOUND)
    return c.json(item)
  })

  .patch("/:id/saved", async (c) => {
    const meals = createMealsModule(c.env)
    const result = await meals.toggleSaved({
      id: c.req.param("id"),
      memberId: c.var.session.user.id,
    })
    if (result.ok) return c.json({ ok: true, savedAt: result.meal.savedAt })
    return apiError(c, 404, result.error)
  })

  .post(
    "/:id/refine",
    zValidator("json", mealRefineSchema, onInvalidInput),
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
    "/:id/override",
    zValidator("json", mealOverridePatchSchema, onInvalidInput),
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

  .get("/:id/photo", async (c) => {
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
