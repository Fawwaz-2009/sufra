import { describe, expect, it } from "vitest"
import { get, patchJson, setupHost, signInAs } from "../../support/harness.ts"

/**
 * Settings over real D1 (ADR 0013) — the instance config singleton, host-only. Seeded by Setup (so these
 * tests create the Host via the REAL `POST /setup`). `show` reads the vision model + family name; `update`
 * edits them (an unknown model id is rejected at the contract boundary). A non-host gets a uniform 404.
 */

type Settings = { visionModelId: string; familyName: string }

describe("Settings (request)", () => {
  it("404s for a non-host; the Host can read it", async () => {
    const host = await setupHost({ familyName: "Smith" })
    const member = await signInAs("kid")
    expect((await get("/api/settings", member)).status).toBe(404)
    expect((await patchJson("/api/settings", { visionModelId: "google/gemini-2.5-flash" }, member)).status).toBe(404)
    expect((await get("/api/settings", host)).status).toBe(200)
  })

  it("reads the seeded settings and updates the vision model", async () => {
    const host = await setupHost({ familyName: "Smith" })
    const initial = (await (await get("/api/settings", host)).json()) as Settings
    expect(initial.familyName).toBe("Smith")
    expect(initial.visionModelId).toBeTruthy()

    const patched = await patchJson("/api/settings", { visionModelId: "google/gemini-2.5-flash" }, host)
    expect(patched.status).toBe(200)
    expect(await patched.json()).toMatchObject({ visionModelId: "google/gemini-2.5-flash" })

    const reread = (await (await get("/api/settings", host)).json()) as Settings
    expect(reread.visionModelId).toBe("google/gemini-2.5-flash")
  })

  it("400s an unknown vision model id", async () => {
    const host = await setupHost()
    expect((await patchJson("/api/settings", { visionModelId: "made/up-model" }, host)).status).toBe(400)
  })
})
