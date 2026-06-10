import { describe, expect, it } from "vitest"
import { cookieHeaderFrom, get, post, postJson, signInAs, testEnv } from "../../support/harness.ts"

/**
 * Password links over real D1 (ADR 0016) — the no-email credential handoff. The Host issues a singular
 * link per Member (`POST /admin/members/:id/password-link`); the public, token-addressed surface shows it
 * (`GET /password-links/:token`) and redeems it (`POST /password-links/:token/password` → set password +
 * sign in). An invalid/expired/consumed token is a uniform 404 (no existence leak — ADR 0013).
 */

type Member = { id: string; username: string; createdAt: string }
type Issued = { token: string; expiresAt: string }

const createMember = async (host: string, username: string): Promise<Member> =>
  (await (await postJson("/api/admin/members", { username }, host)).json()) as Member

const issueLink = async (host: string, memberId: string): Promise<Issued> =>
  (await (await post(`/api/admin/members/${memberId}/password-link`, host)).json()) as Issued

describe("Password links (request)", () => {
  it("404s an unknown token (no existence leak)", async () => {
    expect((await get("/api/password-links/nope")).status).toBe(404)
  })

  it("issues, shows, and redeems a link — the Member sets a password and is signed in", async () => {
    const host = await signInAs("chef", { role: "host" })
    const member = await createMember(host, "kid")
    const { token } = await issueLink(host, member.id)

    const shown = await get(`/api/password-links/${token}`)
    expect(shown.status).toBe(200)
    expect(await shown.json()).toMatchObject({ username: "kid", familyName: "My" })

    const redeemed = await postJson(`/api/password-links/${token}/password`, { password: "kid-pass-1" })
    expect(redeemed.status).toBe(200)
    expect(cookieHeaderFrom(redeemed)).toBeDefined() // signed in via the redeem Set-Cookie

    // The link is consumed.
    expect((await get(`/api/password-links/${token}`)).status).toBe(404)

    // The Member can now sign in with the chosen password.
    const signIn = await postJson("/api/auth/sign-in/username", { username: "kid", password: "kid-pass-1" })
    expect(signIn.ok).toBe(true)
  })

  it("regenerating replaces the old token in place (one active link per Member)", async () => {
    const host = await signInAs("chef", { role: "host" })
    const member = await createMember(host, "kid")
    const first = await issueLink(host, member.id)
    const second = await issueLink(host, member.id)

    expect(second.token).not.toBe(first.token)
    expect((await get(`/api/password-links/${first.token}`)).status).toBe(404) // old token dead
    expect((await get(`/api/password-links/${second.token}`)).status).toBe(200)

    const n = await testEnv.DB.prepare(`SELECT COUNT(*) AS n FROM password_links WHERE userId = ?`)
      .bind(member.id)
      .first<{ n: number }>()
    expect(n?.n).toBe(1)
  })

  it("400s a too-short password on redeem", async () => {
    const host = await signInAs("chef", { role: "host" })
    const member = await createMember(host, "kid")
    const { token } = await issueLink(host, member.id)
    expect((await postJson(`/api/password-links/${token}/password`, { password: "12345" })).status).toBe(400)
  })
})
