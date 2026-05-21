import { and, asc, desc, eq, gte, lt } from "drizzle-orm"

import { createDb } from "../db"
import { profileLog, weightLog } from "../db/schema"
import { ERROR_CODES } from "../errors"
import type { WeightLogCreateInput, WeightLogItem } from "./schema"

type WeightsEnv = { DB: D1Database }

// Weights module — owns all reads + writes against `weight_log`.
//
// Writes do the atomic dual-insert that PATCH /api/profile used to do for
// the `weightKg` field: `weight_log` gets the measurement record, `profile_log`
// gets a new snapshot with `effective_from = tomorrow_local` so the plan
// updates per ADR 0002. UNIQUE(user_id, effective_from) + ON CONFLICT UPDATE
// handles "logged twice on the same day."
//
// Deletes target `weight_log` only — never `profile_log`. See ADR 0007.
export function createWeightsModule(env: WeightsEnv) {
  const db = createDb(env.DB)

  return {
    async list(args: {
      memberId: string
      from: string
      to: string
    }): Promise<WeightLogItem[]> {
      const rows = await db
        .select({
          id: weightLog.id,
          weightKg: weightLog.weightKg,
          loggedAt: weightLog.loggedAt,
        })
        .from(weightLog)
        .where(
          and(
            eq(weightLog.userId, args.memberId),
            gte(weightLog.loggedAt, args.from),
            lt(weightLog.loggedAt, args.to)
          )
        )
        .orderBy(asc(weightLog.loggedAt))
      return rows
    },

    async latest(memberId: string): Promise<WeightLogItem | null> {
      const [row] = await db
        .select({
          id: weightLog.id,
          weightKg: weightLog.weightKg,
          loggedAt: weightLog.loggedAt,
        })
        .from(weightLog)
        .where(eq(weightLog.userId, memberId))
        .orderBy(desc(weightLog.loggedAt))
        .limit(1)
      return row ?? null
    },

    async create(memberId: string, body: WeightLogCreateInput) {
      const [latestProfile] = await db
        .select()
        .from(profileLog)
        .where(eq(profileLog.userId, memberId))
        .orderBy(desc(profileLog.effectiveFrom))
        .limit(1)
      if (!latestProfile) {
        return { ok: false as const, error: ERROR_CODES.NOT_FOUND }
      }

      const now = new Date()

      const merged = {
        sex: latestProfile.sex,
        birthday: latestProfile.birthday,
        heightCm: latestProfile.heightCm,
        displayHeightUnit: latestProfile.displayHeightUnit,
        weightKg: body.weightKg,
        displayWeightUnit:
          body.displayWeightUnit ?? latestProfile.displayWeightUnit,
        activityLevel: latestProfile.activityLevel,
        goalWeightKg: latestProfile.goalWeightKg,
        weeklyRateKg: latestProfile.weeklyRateKg,
      }

      await db
        .insert(profileLog)
        .values({
          id: crypto.randomUUID(),
          userId: memberId,
          effectiveFrom: body.effectiveFrom,
          createdAt: now,
          ...merged,
        })
        .onConflictDoUpdate({
          target: [profileLog.userId, profileLog.effectiveFrom],
          set: { ...merged, createdAt: now },
        })

      const [inserted] = await db
        .insert(weightLog)
        .values({
          userId: memberId,
          weightKg: body.weightKg,
          loggedAt: now.toISOString(),
          createdAt: now,
        })
        .returning({
          id: weightLog.id,
          weightKg: weightLog.weightKg,
          loggedAt: weightLog.loggedAt,
        })

      return { ok: true as const, weight: inserted! }
    },

    // Delete a single weight_log row owned by this Member.
    // Per ADR 0007: never touches profile_log. Historical Day Summaries that
    // were derived from this weight stay as they were — past plans are sealed.
    async delete(args: { id: number; memberId: string }) {
      const [row] = await db
        .select({ userId: weightLog.userId })
        .from(weightLog)
        .where(eq(weightLog.id, args.id))
      if (!row || row.userId !== args.memberId) {
        return { ok: false as const, error: ERROR_CODES.NOT_FOUND }
      }
      await db.delete(weightLog).where(eq(weightLog.id, args.id))
      return { ok: true as const }
    },
  }
}

export type WeightsModule = ReturnType<typeof createWeightsModule>
