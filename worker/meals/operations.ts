import { and, asc, eq, gte, lt } from "drizzle-orm"

import { createDb } from "../db"
import type { MealOverride } from "../db/schema"
import { meal } from "../db/schema"

import {
  estimateMeal,
  MAX_IMAGE_BYTES,
  VisionError,
  type MealAnalysis,
} from "./estimator"

type MealsEnv = {
  DB: D1Database
  BUCKET: R2Bucket
  OPENROUTER_API_KEY: string
}

export function createMealsModule(env: MealsEnv) {
  const db = createDb(env.DB)

  return {
    async list(args: { memberId: string; from: string; to: string }) {
      const rows = await db
        .select()
        .from(meal)
        .where(
          and(
            eq(meal.userId, args.memberId),
            gte(meal.capturedAt, args.from),
            lt(meal.capturedAt, args.to)
          )
        )
        .orderBy(asc(meal.capturedAt))
      return rows.map(toSummary)
    },

    async get(args: { id: string; memberId: string }) {
      const row = await fetchOwned(db, args.id, args.memberId)
      return row ? toDetail(row) : null
    },

    async streamPhoto(args: { id: string; memberId: string }) {
      const [row] = await db
        .select({ photoR2Key: meal.photoR2Key, userId: meal.userId })
        .from(meal)
        .where(eq(meal.id, args.id))
      if (!row || row.userId !== args.memberId) return null
      return env.BUCKET.get(row.photoR2Key)
    },

    async create(args: {
      memberId: string
      photo: Uint8Array
      contentType: string
    }) {
      if (args.photo.byteLength > MAX_IMAGE_BYTES) {
        throw new VisionError(
          "image-too-large",
          `Image exceeds ${MAX_IMAGE_BYTES} bytes`
        )
      }

      const result = await estimateMeal(env, args.photo)

      const id = crypto.randomUUID()
      const photoKey = `meals/${args.memberId}/${id}.jpg`
      const now = new Date()

      await env.BUCKET.put(photoKey, args.photo, {
        httpMetadata: { contentType: args.contentType },
      })

      await db.insert(meal).values({
        id,
        userId: args.memberId,
        capturedAt: now.toISOString(),
        photoR2Key: photoKey,
        aiAnalysis: result.analysis,
        kcalTotal: sumKcal(result.analysis),
        createdAt: now,
      })

      const row = await fetchOwned(db, id, args.memberId)
      return toDetail(row!)
    },

    async setOverride(args: {
      id: string
      memberId: string
      patch: {
        kcal?: number | null
        proteinG?: number | null
        carbsG?: number | null
        fatG?: number | null
      }
    }) {
      const row = await fetchOwned(db, args.id, args.memberId)
      if (!row) return { ok: false as const, error: "not_found" as const }

      const next: MealOverride = { ...(row.override ?? {}) }
      for (const k of ["kcal", "proteinG", "carbsG", "fatG"] as const) {
        if (k in args.patch) {
          const v = args.patch[k]
          if (v === null || v === undefined) delete next[k]
          else if (typeof v === "number" && Number.isFinite(v) && v >= 0)
            next[k] = v
        }
      }
      const cleaned = Object.keys(next).length > 0 ? next : null
      const newKcalTotal = cleaned?.kcal ?? sumKcal(row.aiAnalysis)

      await db
        .update(meal)
        .set({ override: cleaned, kcalTotal: newKcalTotal })
        .where(eq(meal.id, args.id))

      const updated = await fetchOwned(db, args.id, args.memberId)
      return { ok: true as const, meal: toDetail(updated!) }
    },

    async refine(args: { id: string; memberId: string; userText: string }) {
      const row = await fetchOwned(db, args.id, args.memberId)
      if (!row) return { ok: false as const, error: "not_found" as const }

      const obj = await env.BUCKET.get(row.photoR2Key)
      if (!obj) {
        return { ok: false as const, error: "photo_missing" as const }
      }
      const photo = new Uint8Array(await obj.arrayBuffer())

      const result = await estimateMeal(env, photo, { userText: args.userText })
      const newKcalTotal = row.override?.kcal ?? sumKcal(result.analysis)

      await db
        .update(meal)
        .set({ aiAnalysis: result.analysis, kcalTotal: newKcalTotal })
        .where(eq(meal.id, args.id))

      const updated = await fetchOwned(db, args.id, args.memberId)
      return { ok: true as const, meal: toDetail(updated!) }
    },
  }
}

export type MealsModule = ReturnType<typeof createMealsModule>

async function fetchOwned(
  db: ReturnType<typeof createDb>,
  id: string,
  memberId: string
) {
  const [row] = await db.select().from(meal).where(eq(meal.id, id))
  if (!row || row.userId !== memberId) return null
  return row
}

function sumKcal(analysis: MealAnalysis): number {
  return analysis.foods.reduce((acc, f) => acc + f.estimatedKcal, 0)
}

function resolveTotals(
  analysis: MealAnalysis,
  override: MealOverride | null
) {
  const sum = (
    k: "estimatedKcal" | "estimatedProteinG" | "estimatedCarbsG" | "estimatedFatG"
  ) => analysis.foods.reduce((acc, f) => acc + f[k], 0)
  const o = override ?? {}
  return {
    kcal: o.kcal ?? sum("estimatedKcal"),
    proteinG: o.proteinG ?? sum("estimatedProteinG"),
    carbsG: o.carbsG ?? sum("estimatedCarbsG"),
    fatG: o.fatG ?? sum("estimatedFatG"),
  }
}

function toSummary(row: typeof meal.$inferSelect) {
  return {
    id: row.id,
    capturedAt: row.capturedAt,
    photoR2Key: row.photoR2Key,
    dishName: row.aiAnalysis.dishName,
    overallConfidence: row.aiAnalysis.overallConfidence,
    totals: resolveTotals(row.aiAnalysis, row.override),
  }
}

function toDetail(row: typeof meal.$inferSelect) {
  return {
    id: row.id,
    capturedAt: row.capturedAt,
    aiAnalysis: row.aiAnalysis,
    override: row.override,
  }
}
