// Meals domain schemas + types. Single source of truth for Meal shape:
// drizzle's `meal` table feeds the row type via `$inferSelect`, projections
// for the API are built via TypeScript `Pick`, and write schemas (override
// patch + refine body) live as zod objects whose inferred types feed both
// the operations module and the route handler. See ADR 0004.
//
// JSON columns: `meal.aiAnalysis` is typed via `$type<MealAnalysis>()` in
// db/schema.ts and `meal.override` is typed via `$type<MealOverride>()`.
// drizzle-zod's createInsertSchema would erase those to `unknown`, so we
// don't use drizzle-zod for the meal table — the writes here are JSON
// payloads, not column-by-column inserts. Hand-written zod schemas
// (mealOverridePatchSchema, mealRefineSchema) cover those.
//
// Runtime zod schemas are worker-only. The SPA imports types ONLY via
// `import type` (verbatimModuleSyntax erases the import).

import { z } from "zod"

import { meal, type MealOverride } from "../db/schema"
import { ERROR_CODES } from "../errors"
import type { Confidence, MealAnalysis } from "./estimator/schema"
import type { ResolvedTotals } from "./isomorphic/totals"

export type { MealOverride }

// Canonical row type. `meal.capturedAt` is a text column (ISO Z string), so
// no Date-vs-string seam mapping is needed for that field. `meal.createdAt`
// IS a timestamp column (Date in `$inferSelect`); the API projections below
// don't expose it, so no seam transform is required for v1 reads.
export type Meal = typeof meal.$inferSelect

// Response projection for GET /api/meals. Each item carries the resolved
// Totals (override-first, see ADR 0003) and the user-facing dishName /
// overallConfidence lifted out of the AI analysis JSON. `savedAt` is
// deliberately NOT included — MealCard does not render saved-state and the
// saved-meals surfaces (Profile / picker) are filtered by definition.
// See ADR 0008.
export type MealListItem = Pick<
  Meal,
  "id" | "capturedAt" | "photoR2Key"
> & {
  dishName: string
  overallConfidence: Confidence
  totals: ResolvedTotals
}

// Response projection for GET /api/meals/:id. The full AI analysis ships so
// the detail view can render per-food breakdowns and clarifications; the
// override (if any) ships alongside so the editor can show prior values.
// `savedAt` ships so the detail-page header bookmark toggle can render filled
// or outline (the only place saved-state surfaces in the UI — see ADR 0008).
export type MealDetail = Pick<Meal, "id" | "capturedAt"> & {
  aiAnalysis: MealAnalysis
  override: MealOverride | null
  savedAt: string | null
}

// PATCH /api/meals/:id/override body. Each macro field is independently
// nullable (clearing an override) or omittable (untouched). Per the
// override-first composition rule (ADR 0003), unset fields fall back to
// `sum(estimate.foods.field)`.
export const mealOverridePatchSchema = z.object({
  kcal: z.number().nonnegative().nullable().optional(),
  proteinG: z.number().nonnegative().nullable().optional(),
  carbsG: z.number().nonnegative().nullable().optional(),
  fatG: z.number().nonnegative().nullable().optional(),
})

export type MealOverridePatchInput = z.infer<typeof mealOverridePatchSchema>

// POST /api/meals/:id/refine body. `userText` is the Member's free-text
// context that gets passed back to the model alongside the original photo;
// a non-empty trimmed string is required.
export const mealRefineSchema = z.object({
  userText: z.string().trim().min(1, ERROR_CODES.MISSING_USER_TEXT),
})

export type MealRefineInput = z.infer<typeof mealRefineSchema>
