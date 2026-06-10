import { describe, expect, it } from "vitest"
import { get, postJson, signInAs } from "../../support/harness.ts"

/**
 * Calorie history over real D1 (ADR 0011 read-model) — the Progress Calories rollup. Meals are created via
 * the API (the deterministic `EstimatorTest` → 500 kcal each), placed on specific local days via
 * `capturedAt`; the endpoint buckets them by the Member's TZ, attaches the historical Target (derived per
 * day from the active Profile snapshot), and colors each bar against it.
 */

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00])
const photo = () => ({ filename: "meal.png", data: btoa(String.fromCharCode(...PNG)) })

const ONBOARD = {
  effectiveFrom: "2026-06-08",
  sex: "male",
  birthday: "1990-05-21",
  heightCm: 180,
  displayHeightUnit: "cm",
  weightKg: 80,
  displayWeightUnit: "kg",
  activityLevel: "moderate",
  goalWeightKg: 75,
  weeklyRateKg: 0.5
}

type Bucket = { bucketStart: string; kcalAvg: number; targetAvg: number; color: string | null; daysWithData: number }

const addMeal = (cookie: string, capturedAt: string) =>
  postJson("/api/meals", { photo: photo(), capturedAt }, cookie)

const history = async (cookie: string, bucket: "day" | "week" | "month"): Promise<ReadonlyArray<Bucket>> =>
  (await (
    await get(`/api/calorie-history?from=2026-06-08T00:00:00.000Z&to=2026-06-11T00:00:00.000Z&bucket=${bucket}&tz=UTC`, cookie)
  ).json()) as ReadonlyArray<Bucket>

describe("Calorie history (request)", () => {
  it("rejects unauthenticated access with 401", async () => {
    expect(
      (await get("/api/calorie-history?from=2026-06-08T00:00:00.000Z&to=2026-06-11T00:00:00.000Z&bucket=day&tz=UTC"))
        .status
    ).toBe(401)
  })

  it("buckets meal Totals by local day, with avg-over-logged-days + a Target-relative color", async () => {
    const cookie = await signInAs("ada")
    await postJson("/api/profile-snapshots", ONBOARD, cookie) // snapshot effective 2026-06-08 → Target ~2163

    // Two meals on the 8th (1000 kcal), one on the 9th (500); the 10th stays empty.
    await addMeal(cookie, "2026-06-08T08:00:00.000Z")
    await addMeal(cookie, "2026-06-08T19:00:00.000Z")
    await addMeal(cookie, "2026-06-09T12:00:00.000Z")

    const days = await history(cookie, "day")
    expect(days.length).toBe(3) // 06-08, 06-09, 06-10 (to is exclusive)
    expect(days.map((b) => b.bucketStart)).toEqual(["2026-06-08", "2026-06-09", "2026-06-10"])

    const [d8, d9, d10] = days
    expect(d8).toMatchObject({ kcalAvg: 1000, daysWithData: 1, color: "ok" }) // 1000 < ~2163 Target
    expect(d8!.targetAvg).toBeGreaterThan(1500) // the derived Target is attached
    expect(d9).toMatchObject({ kcalAvg: 500, daysWithData: 1, color: "ok" })
    expect(d10).toMatchObject({ kcalAvg: 0, daysWithData: 0, color: null }) // empty day → no bar color
  })

  it("rolls days up to a single week bucket (avg over the logged days only)", async () => {
    const cookie = await signInAs("ada")
    await postJson("/api/profile-snapshots", ONBOARD, cookie)
    await addMeal(cookie, "2026-06-08T08:00:00.000Z")
    await addMeal(cookie, "2026-06-08T19:00:00.000Z")
    await addMeal(cookie, "2026-06-09T12:00:00.000Z")

    const weeks = await history(cookie, "week")
    expect(weeks.length).toBe(1) // 06-08..06-10 are one ISO week (the 8th is a Monday)
    expect(weeks[0]).toMatchObject({ bucketStart: "2026-06-08", daysWithData: 2, kcalAvg: 750 }) // (1000+500)/2
  })

  it("400s an unknown bucket granularity", async () => {
    const cookie = await signInAs("ada")
    expect(
      (await get(`/api/calorie-history?from=2026-06-08T00:00:00.000Z&to=2026-06-11T00:00:00.000Z&bucket=year&tz=UTC`, cookie))
        .status
    ).toBe(400)
  })

  it("400s a malformed range instead of 500ing (the rollup feeds Date/Intl that throw on bad input)", async () => {
    const cookie = await signInAs("ada")
    expect(
      (await get(`/api/calorie-history?from=not-a-date&to=2026-06-11T00:00:00.000Z&bucket=day&tz=UTC`, cookie)).status
    ).toBe(400)
  })
})
