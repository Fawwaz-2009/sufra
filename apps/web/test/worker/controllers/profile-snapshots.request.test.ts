import { describe, expect, it } from "vitest"
import { get, postJson, signInAs, testEnv } from "../../support/harness.ts"

/**
 * Profile snapshots over real D1 inside workerd — the append-only Profile history (ADR 0001/0011). The
 * first POST is onboarding (same-day + seeds the first Weight); subsequent POSTs are effective-tomorrow
 * upserts (the seal — ADR 0002). Weight changes are ignored here (they flow through POST /weights —
 * ADR 0007).
 */

const TODAY = "2026-06-08"
const TOMORROW = "2026-06-09"

const snapshot = (overrides: Record<string, unknown> = {}) => ({
  effectiveFrom: TODAY,
  sex: "male",
  birthday: "1990-05-21",
  heightCm: 180,
  displayHeightUnit: "cm",
  weightKg: 80,
  displayWeightUnit: "kg",
  activityLevel: "moderate",
  goalWeightKg: 75,
  weeklyRateKg: 0.5,
  ...overrides
})

type SnapshotView = {
  id: string
  effectiveFrom: string
  weightKg: number
  goalWeightKg: number
}
type Me = { isOnboarded: boolean; profiles: ReadonlyArray<SnapshotView> }

const showMe = async (cookie: string): Promise<Me> => (await (await get("/api/me", cookie)).json()) as Me

const countRows = async (table: string, userId: string): Promise<number> => {
  const row = await testEnv.DB.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE userId = ?`)
    .bind(userId)
    .first<{ n: number }>()
  return row?.n ?? 0
}

describe("Profile snapshots (request)", () => {
  it("rejects unauthenticated access with 401", async () => {
    expect((await postJson("/api/profile-snapshots", snapshot())).status).toBe(401)
  })

  it("onboards: applies same-day, seeds the first Weight, flips isOnboarded", async () => {
    const cookie = await signInAs("ada")

    // Before onboarding: no snapshot, isOnboarded false.
    const before = await showMe(cookie)
    expect(before.isOnboarded).toBe(false)
    expect(before.profiles.length).toBe(0)

    const res = await postJson("/api/profile-snapshots", snapshot(), cookie)
    expect(res.status).toBe(201)
    const created = (await res.json()) as SnapshotView
    expect(created.effectiveFrom).toBe(TODAY)
    expect(created.weightKg).toBe(80)

    const me = await showMe(cookie)
    expect(me.isOnboarded).toBe(true)
    expect(me.profiles.length).toBe(1)

    // The first Weight measurement was seeded atomically alongside the snapshot.
    const uid = (await testEnv.DB.prepare(`SELECT id FROM users LIMIT 1`).first<{ id: string }>())?.id ?? ""
    expect(await countRows("profile_snapshots", uid)).toBe(1)
    expect(await countRows("weights", uid)).toBe(1)
    const seeded = await testEnv.DB.prepare(`SELECT weightKg FROM weights WHERE userId = ?`)
      .bind(uid)
      .first<{ weightKg: number }>()
    expect(seeded?.weightKg).toBe(80)
  })

  it("edits append a tomorrow snapshot; weight is pinned to the latest (ADR 0007), not the payload", async () => {
    const cookie = await signInAs("ada")
    await postJson("/api/profile-snapshots", snapshot(), cookie)

    // An edit changes the goal and (wrongly) tries to change weight — weight must be ignored here.
    const res = await postJson(
      "/api/profile-snapshots",
      snapshot({ effectiveFrom: TOMORROW, goalWeightKg: 70, weightKg: 60 }),
      cookie
    )
    expect(res.status).toBe(201)

    const me = await showMe(cookie)
    expect(me.profiles.length).toBe(2)
    expect(me.profiles[0]!.effectiveFrom).toBe(TOMORROW) // newest first
    expect(me.profiles[0]!.goalWeightKg).toBe(70)
    expect(me.profiles[0]!.weightKg).toBe(80) // pinned to onboarding weight, NOT the payload's 60

    // No new Weight measurement on an edit (only onboarding + POST /weights seed weights).
    const uid = (await testEnv.DB.prepare(`SELECT id FROM users LIMIT 1`).first<{ id: string }>())?.id ?? ""
    expect(await countRows("weights", uid)).toBe(1)
  })

  it("edited twice the same day upserts the pending row in place (ADR 0002)", async () => {
    const cookie = await signInAs("ada")
    await postJson("/api/profile-snapshots", snapshot(), cookie)

    await postJson("/api/profile-snapshots", snapshot({ effectiveFrom: TOMORROW, goalWeightKg: 72 }), cookie)
    await postJson("/api/profile-snapshots", snapshot({ effectiveFrom: TOMORROW, goalWeightKg: 70 }), cookie)

    const me = await showMe(cookie)
    expect(me.profiles.length).toBe(2) // onboarding (today) + ONE tomorrow row, overwritten
    expect(me.profiles[0]!.effectiveFrom).toBe(TOMORROW)
    expect(me.profiles[0]!.goalWeightKg).toBe(70) // the latter write won

    const uid = (await testEnv.DB.prepare(`SELECT id FROM users LIMIT 1`).first<{ id: string }>())?.id ?? ""
    expect(await countRows("profile_snapshots", uid)).toBe(2)
  })

  it("rejects an out-of-range weight before it reaches the DB", async () => {
    const cookie = await signInAs("ada")
    const res = await postJson("/api/profile-snapshots", snapshot({ weightKg: 5 }), cookie)
    expect(res.status).toBe(400)
  })
})
