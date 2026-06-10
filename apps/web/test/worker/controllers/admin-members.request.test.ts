import { describe, expect, it } from "vitest"
import { cookieHeaderFrom, del, get, post, postJson, signInAs, testEnv } from "../../support/harness.ts"

/**
 * Admin members over real D1 (ADR 0011/0013) — the Host's instance-wide view of the household accounts,
 * behind the HostOnly 404-gate (a non-host gets the SAME 404 a non-owner does — never a 403). The list
 * is the FULL household (Hosts included, badged by `role`), but the action gates stay Member-scoped —
 * delete/link against a host 404s. Create is pure (returns the Member; the Password link is a separate
 * issue). Delete cascades the Member's data (D1 has no FK cascade — every delete is explicit) and the
 * credential.
 */

type Member = { id: string; username: string; role: "host" | "member"; createdAt: string }

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

const countFor = async (table: string, userId: string): Promise<number> =>
  (await testEnv.DB.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE userId = ?`).bind(userId).first<{ n: number }>())?.n ??
  0

describe("Admin members (request)", () => {
  it("401s without a session, 404s (not 403) for a non-host", async () => {
    expect((await get("/api/admin/members")).status).toBe(401)
    const member = await signInAs("kid") // defaultRole member
    expect((await get("/api/admin/members", member)).status).toBe(404)
    expect((await postJson("/api/admin/members", { username: "x" }, member)).status).toBe(404)
  })

  it("lists, creates, and rejects a duplicate username", async () => {
    const host = await signInAs("chef", { role: "host" })
    // The list is the full household — the Host appears in their own list, badged by role.
    const initial = (await (await get("/api/admin/members", host)).json()) as ReadonlyArray<Member>
    expect(initial.map((m) => [m.username, m.role])).toEqual([["chef", "host"]])

    const created = await postJson("/api/admin/members", { username: "kid" }, host)
    expect(created.status).toBe(201)
    const kid = (await created.json()) as Member
    expect([kid.username, kid.role]).toEqual(["kid", "member"])

    const list = (await (await get("/api/admin/members", host)).json()) as ReadonlyArray<Member>
    expect(list.map((m) => [m.username, m.role])).toEqual([
      ["chef", "host"],
      ["kid", "member"]
    ])

    expect((await postJson("/api/admin/members", { username: "kid" }, host)).status).toBe(409)
  })

  it("404s deleting a non-member / foreign id / the Host itself", async () => {
    const host = await signInAs("chef", { role: "host" })
    const me = (await (await get("/api/me", host)).json()) as { id: string }
    expect((await del(`/api/admin/members/${me.id}`, host)).status).toBe(404) // the Host is not a Member
    expect((await del("/api/admin/members/does-not-exist", host)).status).toBe(404)
  })

  it("deletes a Member and cascades their data (snapshots/weights/link + credential)", async () => {
    const host = await signInAs("chef", { role: "host" })
    const member = (await (await postJson("/api/admin/members", { username: "kid" }, host)).json()) as Member

    // Give the Member a password (redeem a link) so they can sign in + onboard.
    const issued = (await (await post(`/api/admin/members/${member.id}/password-link`, host)).json()) as { token: string }
    const kid = cookieHeaderFrom(await postJson(`/api/password-links/${issued.token}/password`, { password: "kid-pass-1" }))!
    await postJson("/api/profile-snapshots", ONBOARD, kid) // snapshot + first weight
    await post(`/api/admin/members/${member.id}/password-link`, host) // a live link at delete time

    expect(await countFor("profile_snapshots", member.id)).toBeGreaterThan(0)
    expect(await countFor("weights", member.id)).toBeGreaterThan(0)
    expect(await countFor("password_links", member.id)).toBe(1)

    expect((await del(`/api/admin/members/${member.id}`, host)).status).toBe(204)

    expect(await countFor("profile_snapshots", member.id)).toBe(0)
    expect(await countFor("weights", member.id)).toBe(0)
    expect(await countFor("password_links", member.id)).toBe(0)
    expect(
      (await testEnv.DB.prepare(`SELECT COUNT(*) AS n FROM users WHERE id = ?`).bind(member.id).first<{ n: number }>())?.n
    ).toBe(0)
    expect(
      (await testEnv.DB.prepare(`SELECT COUNT(*) AS n FROM "identities" WHERE id = ?`).bind(member.id).first<{ n: number }>())?.n
    ).toBe(0)

    // Re-deleting now 404s.
    expect((await del(`/api/admin/members/${member.id}`, host)).status).toBe(404)
  })
})
