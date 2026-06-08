import { describe, expect, it } from "vitest"
import { cookieHeaderFrom, get, postJson, testEnv } from "../../support/harness.ts"

/**
 * Setup over real D1 inside workerd (CONTEXT "Setup"; ADR 0010/0016). The PUBLIC bootstrap: `GET /setup`
 * reports whether a Host exists; `POST /setup` creates the first Host, seeds app_settings, and signs them
 * in — the response carries Better Auth's session cookie (the `fromWeb` round-trip this suite pins down).
 */

type Me = { id: string; username: string; role: string }

describe("Setup (request)", () => {
  it("reports needsSetup=true on a fresh deploy", async () => {
    const res = await get("/api/setup")
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ needsSetup: true })
  })

  it("creates the first Host, signs them in, seeds app_settings, and closes Setup", async () => {
    const res = await postJson("/api/setup", { familyName: "Smith", username: "chef", password: "host-pass-1" })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })

    // The Set-Cookie round-trips → the session authenticates the very next request.
    const cookie = cookieHeaderFrom(res)
    expect(cookie).toBeDefined()
    const me = (await (await get("/api/me", cookie)).json()) as Me
    expect(me.username).toBe("chef")
    expect(me.role).toBe("host")

    // app_settings seeded with the family name + the default vision model.
    const settings = await testEnv.DB.prepare(
      `SELECT visionModelId, familyName FROM app_settings WHERE id = 1`
    ).first<{ visionModelId: string; familyName: string }>()
    expect(settings?.familyName).toBe("Smith")
    expect(settings?.visionModelId).toBeTruthy()

    // Setup is now closed forever.
    expect(await (await get("/api/setup")).json()).toEqual({ needsSetup: false })
  })

  it("409s a second Setup once a Host exists", async () => {
    await postJson("/api/setup", { familyName: "Smith", username: "chef", password: "host-pass-1" })
    const second = await postJson("/api/setup", { familyName: "Other", username: "chef2", password: "host-pass-2" })
    expect(second.status).toBe(409)
  })

  it("400s invalid input (short username / password / empty family name)", async () => {
    expect((await postJson("/api/setup", { familyName: "Smith", username: "ab", password: "host-pass-1" })).status).toBe(400)
    expect((await postJson("/api/setup", { familyName: "Smith", username: "chef", password: "12345" })).status).toBe(400)
    expect((await postJson("/api/setup", { familyName: "", username: "chef", password: "host-pass-1" })).status).toBe(400)
  })
})
