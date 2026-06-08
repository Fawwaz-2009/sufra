import { describe, expect, it } from "vitest"
import { del, get, post, postJson, putJson, signInAs, testEnv } from "../../support/harness.ts"

/**
 * The meals lifecycle over real D1 + KV + R2 inside workerd. The estimator is the deterministic
 * `EstimatorTest` layer (ENVIRONMENT="test"), so create/refine never touch OpenRouter — they return the
 * fixed "Test Dish" Estimate (500 kcal, 30/50/20 macros).
 */

// A minimal valid PNG (the 8-byte signature is all the sniffer reads) — enough to pass the media gate.
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00])
const toBase64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes))
const photo = () => ({ filename: "meal.png", data: toBase64(PNG) })

type MealView = {
  id: string
  capturedAt: string
  photoUrl: string
  aiAnalysis: { dishName: string; foods: Array<unknown>; overallConfidence: string }
  override: { kcal?: number } | null
  savedAt: string | null
  lastRefinementText: string | null
  totals: { kcal: number; proteinG: number; carbsG: number; fatG: number }
}
type ListItem = { id: string; dishName: string; photoUrl: string; totals: { kcal: number } }

const createMeal = async (cookie: string): Promise<MealView> => {
  const res = await postJson("/api/meals", { photo: photo() }, cookie)
  expect(res.status).toBe(201)
  return (await res.json()) as MealView
}

describe("Meals (request)", () => {
  it("rejects unauthenticated access with 401", async () => {
    expect((await get("/api/meals")).status).toBe(401)
  })

  it("creates a meal from a photo, gated on the estimator", async () => {
    const cookie = await signInAs("ada")
    const meal = await createMeal(cookie)

    expect(meal.aiAnalysis.dishName).toBe("Test Dish")
    expect(meal.totals.kcal).toBe(500)
    expect(meal.totals.proteinG).toBe(30)
    expect(meal.photoUrl).toBe(`/api/meals/${meal.id}/photo`)
    expect(meal.override).toBe(null)
    expect(meal.savedAt).toBe(null)

    // A row exists ⟺ it has an Estimate; the photo is an attachment, not a column.
    const mealRow = await testEnv.DB.prepare(`SELECT aiAnalysis FROM meals WHERE id = ?`).bind(meal.id).first<{
      aiAnalysis: string
    }>()
    expect(mealRow?.aiAnalysis).toContain("Test Dish")
    const attachment = await testEnv.DB.prepare(
      `SELECT contentType FROM attachments WHERE recordType = 'meal' AND recordId = ? AND name = 'photo'`
    )
      .bind(meal.id)
      .first<{ contentType: string }>()
    expect(attachment?.contentType).toBe("image/png")

    // The decoupled audit recorded the estimate cost.
    const runs = await testEnv.DB.prepare(
      `SELECT kind, status FROM inference_runs WHERE userId = (SELECT id FROM users LIMIT 1)`
    ).all<{ kind: string; status: string }>()
    expect(runs.results.some((r) => r.kind === "estimate" && r.status === "ok")).toBe(true)
  })

  it("rejects a non-image upload with 415 before estimating", async () => {
    const cookie = await signInAs("ada")
    const notAnImage = { filename: "x.txt", data: toBase64(new Uint8Array([1, 2, 3, 4, 5])) }
    const res = await postJson("/api/meals", { photo: notAnImage }, cookie)
    expect(res.status).toBe(415)
  })

  it("shows a meal and serves its photo through the proxy", async () => {
    const cookie = await signInAs("ada")
    const meal = await createMeal(cookie)

    const shown = (await (await get(`/api/meals/${meal.id}`, cookie)).json()) as MealView
    expect(shown.id).toBe(meal.id)

    const photoRes = await get(`/api/meals/${meal.id}/photo`, cookie)
    expect(photoRes.status).toBe(200)
    expect(photoRes.headers.get("content-type")).toContain("image/png")
    expect(new Uint8Array(await photoRes.arrayBuffer())).toEqual(PNG)
  })

  it("lists meals in a captured-at range", async () => {
    const cookie = await signInAs("ada")
    const meal = await createMeal(cookie)
    const items = (await (
      await get("/api/meals?from=2020-01-01T00:00:00.000Z&to=2100-01-01T00:00:00.000Z", cookie)
    ).json()) as Array<ListItem>
    expect(items.some((m) => m.id === meal.id)).toBe(true)
  })

  it("sets and resets the override (PUT replace / DELETE reset)", async () => {
    const cookie = await signInAs("ada")
    const meal = await createMeal(cookie)

    expect((await putJson(`/api/meals/${meal.id}/override`, { kcal: 999 }, cookie)).status).toBe(204)
    const overridden = (await (await get(`/api/meals/${meal.id}`, cookie)).json()) as MealView
    expect(overridden.override?.kcal).toBe(999)
    expect(overridden.totals.kcal).toBe(999) // override-first
    expect(overridden.totals.proteinG).toBe(30) // unset macro falls back to the estimate sum

    expect((await del(`/api/meals/${meal.id}/override`, cookie)).status).toBe(204)
    const reset = (await (await get(`/api/meals/${meal.id}`, cookie)).json()) as MealView
    expect(reset.override).toBe(null)
    expect(reset.totals.kcal).toBe(500)
  })

  it("refines a meal — replaces the Estimate and records the text", async () => {
    const cookie = await signInAs("ada")
    const meal = await createMeal(cookie)

    const res = await postJson(`/api/meals/${meal.id}/refinement`, { userText: "more rice" }, cookie)
    expect(res.status).toBe(200)
    const refined = (await res.json()) as MealView
    expect(refined.lastRefinementText).toBe("more rice")
  })

  it("toggles saved and lists the saved scope", async () => {
    const cookie = await signInAs("ada")
    const meal = await createMeal(cookie)

    expect((await post(`/api/meals/${meal.id}/saved`, cookie)).status).toBe(204)
    let saved = (await (await get("/api/meals?saved=1", cookie)).json()) as Array<ListItem>
    expect(saved.some((m) => m.id === meal.id)).toBe(true)

    expect((await del(`/api/meals/${meal.id}/saved`, cookie)).status).toBe(204)
    saved = (await (await get("/api/meals?saved=1", cookie)).json()) as Array<ListItem>
    expect(saved.some((m) => m.id === meal.id)).toBe(false)
  })

  it("clones a meal into a new independent Meal (201)", async () => {
    const cookie = await signInAs("ada")
    const source = await createMeal(cookie)

    const res = await postJson(`/api/meals/${source.id}/clones`, {}, cookie)
    expect(res.status).toBe(201)
    const clone = (await res.json()) as MealView
    expect(clone.id).not.toBe(source.id)
    expect(clone.aiAnalysis.dishName).toBe("Test Dish")
    expect(clone.savedAt).toBe(null)

    // The clone has its OWN photo (independent lifecycle): deleting the source leaves the clone servable.
    expect((await del(`/api/meals/${source.id}`, cookie)).status).toBe(204)
    expect((await get(`/api/meals/${clone.id}/photo`, cookie)).status).toBe(200)
  })

  it("hard-deletes a meal (204), then it's gone", async () => {
    const cookie = await signInAs("ada")
    const meal = await createMeal(cookie)
    expect((await del(`/api/meals/${meal.id}`, cookie)).status).toBe(204)
    expect((await get(`/api/meals/${meal.id}`, cookie)).status).toBe(404)
  })

  it("404s another Member's meal (scope is authorization, no 403)", async () => {
    const ada = await signInAs("ada")
    const meal = await createMeal(ada)
    const bob = await signInAs("bob")

    expect((await get(`/api/meals/${meal.id}`, bob)).status).toBe(404)
    expect((await get(`/api/meals/${meal.id}/photo`, bob)).status).toBe(404)
    expect((await putJson(`/api/meals/${meal.id}/override`, { kcal: 1 }, bob)).status).toBe(404)
    expect((await del(`/api/meals/${meal.id}`, bob)).status).toBe(404)
  })
})
