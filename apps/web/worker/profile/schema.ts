// Profile domain schemas + types. Single source of truth for Profile shape:
// the drizzle `profileLog` table feeds drizzle-zod's createInsertSchema /
// createUpdateSchema, refinements add numeric/date bounds, and `$inferSelect`
// gives the canonical row type. See ADR 0004.
//
// Runtime values (the zod schemas) are worker-only — drizzle-zod pulls in
// drizzle, which must not reach the SPA bundle. The SPA imports types ONLY
// via `import type` (mechanically erased under verbatimModuleSyntax).
// Numeric bounds + enum tuples that the SPA also needs at runtime live in
// `worker/profile/isomorphic/constants.ts` (ADR 0005).

import { createInsertSchema, createUpdateSchema } from "drizzle-zod"
import { z } from "zod"

import { profileLog } from "../db/schema"
import {
  HEIGHT_CM_MAX,
  HEIGHT_CM_MIN,
  WEEKLY_RATE_KG_MAX,
  WEEKLY_RATE_KG_MIN,
  WEIGHT_KG_MAX,
  WEIGHT_KG_MIN,
} from "./isomorphic/constants"

// Field refinements shared by insert + update. drizzle-zod accepts either a
// callback that extends the inferred column schema, or a complete zod schema
// that replaces it. We use the replacement form — drizzle-zod 0.8's callback
// signature is too generic to narrow per-column. All refined columns here are
// notNull, so replacement preserves nullability semantics.
const refinements = {
  birthday: z.iso.date(),
  weightKg: z.number().min(WEIGHT_KG_MIN).max(WEIGHT_KG_MAX),
  goalWeightKg: z.number().min(WEIGHT_KG_MIN).max(WEIGHT_KG_MAX),
  heightCm: z.number().int().min(HEIGHT_CM_MIN).max(HEIGHT_CM_MAX),
  weeklyRateKg: z
    .number()
    .min(WEEKLY_RATE_KG_MIN)
    .max(WEEKLY_RATE_KG_MAX),
}

// POST /api/onboarding body. The first profile_log row applies same-day
// (ADR 0002), so the body carries `todayLocalDate` (Member's TZ) instead of
// the generic `effectiveFrom` used by edits. Server-managed columns (id,
// userId, createdAt) are omitted.
export const profileOnboardSchema = createInsertSchema(profileLog, refinements)
  .omit({
    id: true,
    userId: true,
    createdAt: true,
    effectiveFrom: true,
  })
  .extend({ todayLocalDate: z.iso.date() })

// PATCH /api/profile body. All Profile fields are optional (merge-with-latest
// at the operations layer), but `effectiveFrom` is required — the client
// computes the Member's local tomorrow and sends it, per ADR 0002.
//
// `.partial()` after `createUpdateSchema` is load-bearing: drizzle-zod's
// replacement refinements (the `refinements` const above) erase the
// optionality that createUpdateSchema would have applied per column. Without
// `.partial()`, sending only `{ goalWeightKg, weeklyRateKg, effectiveFrom }`
// from the goal sheet would fail validation because every refined field
// (birthday, weightKg, heightCm, etc.) would be required. `.partial()`
// re-applies optionality after the refinements have run; `.extend` then
// reinstates the required `effectiveFrom`.
export const profileEditSchema = createUpdateSchema(profileLog, refinements)
  .omit({
    id: true,
    userId: true,
    createdAt: true,
  })
  .partial()
  .extend({ effectiveFrom: z.iso.date() })

export type ProfileOnboardInput = z.infer<typeof profileOnboardSchema>
export type ProfileEditInput = z.infer<typeof profileEditSchema>

// Canonical row type. `$inferSelect` gives `createdAt: Date` (timestamp
// column); after JSON serialization the SPA sees an ISO string. Operations
// .map the Date → string at the seam so the wire shape matches this type.
type ProfileLogRow = typeof profileLog.$inferSelect

export type ProfileSnapshot = Omit<ProfileLogRow, "createdAt"> & {
  createdAt: string
}
