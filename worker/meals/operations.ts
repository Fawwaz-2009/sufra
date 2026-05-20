import { and, desc, eq, gte, lt } from "drizzle-orm"

import { createDb } from "../db"
import type { MealOverride } from "../db/schema"
import { appSettings, inferenceRun, meal } from "../db/schema"
import { ERROR_CODES } from "../errors"

import {
  computeCost,
  DEFAULT_VISION_MODEL_ID,
  estimateMeal,
  getModel,
  MAX_IMAGE_BYTES,
  VisionError,
  type EstimateMealResult,
  type MealAnalysis,
} from "./estimator"

type MealsEnv = {
  DB: D1Database
  BUCKET: R2Bucket
  OPENROUTER_API_KEY: string
}

type Db = ReturnType<typeof createDb>

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
        .orderBy(desc(meal.createdAt))
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
      capturedAt?: string
    }) {
      if (args.photo.byteLength > MAX_IMAGE_BYTES) {
        throw new VisionError(
          "image-too-large",
          `Image exceeds ${MAX_IMAGE_BYTES} bytes`
        )
      }

      const modelId = await readVisionModelId(db)
      const result = await runEstimate({
        db,
        userId: args.memberId,
        kind: "estimate",
        run: () => estimateMeal(env, args.photo, { modelId }),
      })

      const id = crypto.randomUUID()
      const photoKey = `meals/${args.memberId}/${id}.jpg`
      const now = new Date()
      const capturedAt = args.capturedAt ?? now.toISOString()

      await env.BUCKET.put(photoKey, args.photo, {
        httpMetadata: { contentType: args.contentType },
      })

      await db.insert(meal).values({
        id,
        userId: args.memberId,
        capturedAt,
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
      if (!row) return { ok: false as const, error: ERROR_CODES.NOT_FOUND }

      const next: MealOverride = { ...(row.override ?? {}) }
      for (const k of ["kcal", "proteinG", "carbsG", "fatG"] as const) {
        if (!(k in args.patch)) continue
        const v = args.patch[k]
        if (v === null || v === undefined) delete next[k]
        else next[k] = v
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
      if (!row) return { ok: false as const, error: ERROR_CODES.NOT_FOUND }

      const obj = await env.BUCKET.get(row.photoR2Key)
      if (!obj) {
        return { ok: false as const, error: ERROR_CODES.PHOTO_MISSING }
      }
      const photo = new Uint8Array(await obj.arrayBuffer())

      const modelId = await readVisionModelId(db)
      const result = await runEstimate({
        db,
        userId: args.memberId,
        kind: "refinement",
        run: () =>
          estimateMeal(env, photo, { modelId, userText: args.userText }),
      })
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

async function readVisionModelId(db: Db): Promise<string> {
  const [row] = await db
    .select({ visionModelId: appSettings.visionModelId })
    .from(appSettings)
    .where(eq(appSettings.id, 1))
  return row?.visionModelId ?? DEFAULT_VISION_MODEL_ID
}

// Wraps every call to estimateMeal() so cost is captured before any downstream
// persistence can fail. Failed schema-parse runs still produced billable
// tokens — we record those too so monthly cost reflects reality.
async function runEstimate(args: {
  db: Db
  userId: string
  kind: "estimate" | "refinement"
  run: () => Promise<EstimateMealResult>
}): Promise<EstimateMealResult> {
  try {
    const result = await args.run()
    await args.db.insert(inferenceRun).values({
      id: crypto.randomUUID(),
      userId: args.userId,
      modelId: result.modelId,
      kind: args.kind,
      status: "ok",
      errorCode: null,
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
      costUsd: result.costUsd,
      latencyMs: result.latencyMs,
      createdAt: new Date(),
    })
    return result
  } catch (e) {
    if (e instanceof VisionError && e.usage) {
      // The model ran and OpenRouter billed for tokens, but the response
      // didn't match the Zod schema (or another mid-flight failure occurred).
      // Persist the cost row so the bill is not silently absorbed.
      const modelId = await readVisionModelId(args.db)
      const model = getModel(modelId)
      await args.db.insert(inferenceRun).values({
        id: crypto.randomUUID(),
        userId: args.userId,
        modelId,
        kind: args.kind,
        status: "failed",
        errorCode: e.code,
        promptTokens: e.usage.promptTokens,
        completionTokens: e.usage.completionTokens,
        costUsd: computeCost(model, e.usage),
        latencyMs: e.latencyMs ?? 0,
        createdAt: new Date(),
      })
    }
    throw e
  }
}

async function fetchOwned(db: Db, id: string, memberId: string) {
  const [row] = await db.select().from(meal).where(eq(meal.id, id))
  if (!row || row.userId !== memberId) return null
  return row
}

function sumKcal(analysis: MealAnalysis): number {
  return analysis.foods.reduce((acc, f) => acc + f.estimatedKcal, 0)
}

function resolveTotals(analysis: MealAnalysis, override: MealOverride | null) {
  const sum = (
    k:
      | "estimatedKcal"
      | "estimatedProteinG"
      | "estimatedCarbsG"
      | "estimatedFatG"
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
