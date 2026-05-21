// Weights domain schemas + types. Single source of truth for the Weight
// resource exposed at POST /api/weights, GET /api/weights, DELETE /api/weights/:id.
// See ADR 0007: weight_log rows are user-correctable; profile_log rows remain
// sealed.

import { z } from "zod"

import { weightLog } from "../db/schema"
import {
  WEIGHT_KG_MAX,
  WEIGHT_KG_MIN,
  WEIGHT_UNITS,
} from "../profile/isomorphic/constants"

// POST /api/weights body. `displayWeightUnit` carries the unit the Member was
// typing in, so the matching profile_log row's display preference stays in
// sync (mirrors PATCH /api/profile's behavior for the field).
//
// `effectiveFrom` is required — the client computes the Member's local
// tomorrow and sends it, identical to PATCH /api/profile per ADR 0002.
export const weightLogCreateSchema = z.object({
  weightKg: z.number().min(WEIGHT_KG_MIN).max(WEIGHT_KG_MAX),
  displayWeightUnit: z.enum(WEIGHT_UNITS).optional(),
  effectiveFrom: z.iso.date(),
})

export type WeightLogCreateInput = z.infer<typeof weightLogCreateSchema>

// GET /api/weights?from&to range filter. Both inclusive of from, exclusive of
// to — matches GET /api/meals semantics. ISO date-times (UTC) because
// weight_log.logged_at is an ISO Z string.
export const weightLogRangeSchema = z
  .object({
    from: z.iso.datetime(),
    to: z.iso.datetime(),
  })
  .refine(({ from, to }) => Date.parse(to) > Date.parse(from), "invalid_range")

export type WeightLogRangeInput = z.infer<typeof weightLogRangeSchema>

// Wire shape returned by GET /api/weights. `id` is a number (autoincrement
// primary key on weight_log) — the client uses it for DELETE.
type WeightLogRow = typeof weightLog.$inferSelect

export type WeightLogItem = {
  id: WeightLogRow["id"]
  weightKg: WeightLogRow["weightKg"]
  loggedAt: WeightLogRow["loggedAt"]
}
