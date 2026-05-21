import { and, desc, eq } from "drizzle-orm"

import { createDb } from "../db"
import { profileLog, weightLog } from "../db/schema"
import { ERROR_CODES } from "../errors"

type ProfileEnv = { DB: D1Database }

type Sex = "male" | "female"
type ActivityLevel = "sedentary" | "light" | "moderate" | "active"
type HeightUnit = "cm" | "imperial"
type WeightUnit = "kg" | "lb"

export type OnboardInput = {
  sex: Sex
  birthday: string
  heightCm: number
  displayHeightUnit: HeightUnit
  weightKg: number
  displayWeightUnit: WeightUnit
  activityLevel: ActivityLevel
  goalWeightKg: number
  weeklyRateKg: number
  todayLocalDate: string
}

export type EditInput = {
  sex?: Sex
  birthday?: string
  heightCm?: number
  displayHeightUnit?: HeightUnit
  weightKg?: number
  displayWeightUnit?: WeightUnit
  activityLevel?: ActivityLevel
  goalWeightKg?: number
  weeklyRateKg?: number
  effectiveFrom: string
}

export function createProfileModule(env: ProfileEnv) {
  const db = createDb(env.DB)

  return {
    // Returns the Member's full Profile snapshot timeline (effective_from DESC)
    // plus the derived onboarded flag. The flag is the canonical truth — the
    // client SHOULD NOT derive onboarded-ness from `profiles.length`. ADR 0001
    // guarantees that profile_log is append-only and is only ever written by
    // Onboarding (first row) or Profile edits (subsequent rows), so any row at
    // all means the Member has onboarded.
    async getHistory(memberId: string) {
      const rows = await db
        .select()
        .from(profileLog)
        .where(eq(profileLog.userId, memberId))
        .orderBy(desc(profileLog.effectiveFrom))
      return { profiles: rows, isOnboarded: rows.length > 0 }
    },

    // Append a Member's initial Profile snapshot. The first row in profile_log
    // takes effect immediately (effective_from = today_local) — Onboarding is
    // the one Profile write that doesn't follow the "starts tomorrow" rule
    // (ADR 0002). Idempotent guard: if a row already exists, return
    // ALREADY_ONBOARDED — Onboarding is one-shot.
    async onboard(memberId: string, body: OnboardInput) {
      const [existing] = await db
        .select({ id: profileLog.id })
        .from(profileLog)
        .where(eq(profileLog.userId, memberId))
        .limit(1)
      if (existing) {
        return { ok: false as const, error: ERROR_CODES.ALREADY_ONBOARDED }
      }

      const now = new Date()
      const id = crypto.randomUUID()

      await db.insert(profileLog).values({
        id,
        userId: memberId,
        effectiveFrom: body.todayLocalDate,
        createdAt: now,
        sex: body.sex,
        birthday: body.birthday,
        heightCm: body.heightCm,
        displayHeightUnit: body.displayHeightUnit,
        weightKg: body.weightKg,
        displayWeightUnit: body.displayWeightUnit,
        activityLevel: body.activityLevel,
        goalWeightKg: body.goalWeightKg,
        weeklyRateKg: body.weeklyRateKg,
      })

      await db.insert(weightLog).values({
        userId: memberId,
        weightKg: body.weightKg,
        loggedAt: now.toISOString(),
        createdAt: now,
      })

      const [row] = await db
        .select()
        .from(profileLog)
        .where(eq(profileLog.id, id))
      return { ok: true as const, profile: row! }
    },

    // Profile edit. Inserts a new profile_log row with effective_from chosen
    // by the client (Member's tomorrow in their current TZ, per ADR 0002).
    // Unchanged fields are inherited from the latest snapshot. If `weightKg`
    // is present AND differs from the latest snapshot's weight, also appends a
    // weight_log row at logged_at = now (measurement record, ADR 0002).
    //
    // UNIQUE(user_id, effective_from) + ON CONFLICT UPDATE handles "edited
    // twice in one day" — both writes target the same tomorrow row; the
    // second overwrites.
    async edit(memberId: string, body: EditInput) {
      const [latest] = await db
        .select()
        .from(profileLog)
        .where(eq(profileLog.userId, memberId))
        .orderBy(desc(profileLog.effectiveFrom))
        .limit(1)
      if (!latest) return { ok: false as const, error: ERROR_CODES.NOT_FOUND }

      const merged = {
        sex: body.sex ?? latest.sex,
        birthday: body.birthday ?? latest.birthday,
        heightCm: body.heightCm ?? latest.heightCm,
        displayHeightUnit: body.displayHeightUnit ?? latest.displayHeightUnit,
        weightKg: body.weightKg ?? latest.weightKg,
        displayWeightUnit: body.displayWeightUnit ?? latest.displayWeightUnit,
        activityLevel: body.activityLevel ?? latest.activityLevel,
        goalWeightKg: body.goalWeightKg ?? latest.goalWeightKg,
        weeklyRateKg: body.weeklyRateKg ?? latest.weeklyRateKg,
      }

      const now = new Date()
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

      if (body.weightKg !== undefined && body.weightKg !== latest.weightKg) {
        await db.insert(weightLog).values({
          userId: memberId,
          weightKg: body.weightKg,
          loggedAt: now.toISOString(),
          createdAt: now,
        })
      }

      const [row] = await db
        .select()
        .from(profileLog)
        .where(
          and(
            eq(profileLog.userId, memberId),
            eq(profileLog.effectiveFrom, body.effectiveFrom)
          )
        )
      return { ok: true as const, profile: row! }
    },
  }
}

export type ProfileModule = ReturnType<typeof createProfileModule>
