import { describe, expect, it } from "vitest"
import { del, get, postJson, signInAs, testEnv } from "../../support/harness.ts"

/**
 * Weights over real D1 inside workerd — measurement records (ADR 0007). Logging is an atomic dual-append
 * (a weight row + a tomorrow `profile_snapshots` row); a delete touches only `weights`, never the sealed
 * snapshots (ADR 0007).
 */

const TODAY = "2026-06-08"
const TOMORROW = "2026-06-09"
const WIDE = { from: "2000-01-01T00:00:00.000Z", to: "2100-01-01T00:00:00.000Z" }

const onboard = (cookie: string) =>
  postJson(
    "/api/profile-snapshots",
    {
      effectiveFrom: TODAY,
      sex: "male",
      birthday: "1990-05-21",
      heightCm: 180,
      displayHeightUnit: "cm",
      weightKg: 80,
      displayWeightUnit: "kg",
      activityLevel: "moderate",
      goalWeightKg: 75,
      weeklyRateKg: 0.5
    },
    cookie
  )

type WeightView = { id: string; weightKg: number; loggedAt: string }

const listWeights = async (cookie: string): Promise<ReadonlyArray<WeightView>> =>
  (await (await get(`/api/weights?from=${WIDE.from}&to=${WIDE.to}`, cookie)).json()) as ReadonlyArray<WeightView>

const countRows = async (table: string, userId: string): Promise<number> => {
  const row = await testEnv.DB.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE userId = ?`)
    .bind(userId)
    .first<{ n: number }>()
  return row?.n ?? 0
}

describe("Weights (request)", () => {
  it("rejects unauthenticated access with 401", async () => {
    expect((await get(`/api/weights?from=${WIDE.from}&to=${WIDE.to}`)).status).toBe(401)
  })

  it("404s a log before onboarding (no plan to attach to)", async () => {
    const cookie = await signInAs("ada")
    const res = await postJson("/api/weights", { weightKg: 81, effectiveFrom: TOMORROW }, cookie)
    expect(res.status).toBe(404)
  })

  it("logs a Weight: dual-appends the measurement + a tomorrow snapshot", async () => {
    const cookie = await signInAs("ada")
    await onboard(cookie) // seeds the first weight (80) + today's snapshot
    const uid = (await testEnv.DB.prepare(`SELECT id FROM users LIMIT 1`).first<{ id: string }>())?.id ?? ""

    const res = await postJson("/api/weights", { weightKg: 78.5, displayWeightUnit: "kg", effectiveFrom: TOMORROW }, cookie)
    expect(res.status).toBe(201)
    const logged = (await res.json()) as WeightView
    expect(logged.weightKg).toBe(78.5)
    expect(typeof logged.id).toBe("string")

    // The measurement is listed (seed + this one), and a tomorrow snapshot carries the new weight.
    expect((await listWeights(cookie)).length).toBe(2)
    expect(await countRows("weights", uid)).toBe(2)
    expect(await countRows("profile_snapshots", uid)).toBe(2)
    const tomorrow = await testEnv.DB.prepare(
      `SELECT weightKg FROM profile_snapshots WHERE userId = ? AND effectiveFrom = ?`
    )
      .bind(uid, TOMORROW)
      .first<{ weightKg: number }>()
    expect(tomorrow?.weightKg).toBe(78.5)
  })

  it("deletes a Weight without touching the sealed snapshots (ADR 0007)", async () => {
    const cookie = await signInAs("ada")
    await onboard(cookie)
    const uid = (await testEnv.DB.prepare(`SELECT id FROM users LIMIT 1`).first<{ id: string }>())?.id ?? ""
    const logged = (await (
      await postJson("/api/weights", { weightKg: 78.5, effectiveFrom: TOMORROW }, cookie)
    ).json()) as WeightView

    const deleted = await del(`/api/weights/${logged.id}`, cookie)
    expect(deleted.status).toBe(204)

    expect((await listWeights(cookie)).length).toBe(1) // the seed remains
    expect(await countRows("weights", uid)).toBe(1)
    expect(await countRows("profile_snapshots", uid)).toBe(2) // unchanged — sealed plans don't move
  })

  it("404s deleting a weight that isn't yours (uniform scoping, ADR 0013)", async () => {
    const ada = await signInAs("ada")
    await onboard(ada)
    const adaWeight = (await (
      await postJson("/api/weights", { weightKg: 79, effectiveFrom: TOMORROW }, ada)
    ).json()) as WeightView

    const bob = await signInAs("bob")
    expect((await del(`/api/weights/${adaWeight.id}`, bob)).status).toBe(404)
    expect((await del(`/api/weights/does-not-exist`, ada)).status).toBe(404)
  })
})
