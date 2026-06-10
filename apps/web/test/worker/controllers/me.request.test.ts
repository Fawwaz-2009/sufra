import { describe, expect, it } from "vitest"
import { get, signInAs, testEnv } from "../../support/harness.ts"

type Me = {
  readonly id: string
  readonly username: string
  readonly role: string
  readonly isOnboarded: boolean
  readonly profiles: ReadonlyArray<unknown>
}

const showMe = async (cookie: string): Promise<Me> => (await (await get("/api/me", cookie)).json()) as Me

describe("Me (request)", () => {
  it("rejects unauthenticated access with 401", async () => {
    expect((await get("/api/me")).status).toBe(401)
  })

  it("signs a Member in and returns the account", async () => {
    const cookie = await signInAs("ada")

    const me = await showMe(cookie)
    expect(me.username).toBe("ada")
    expect(me.role).toBe("member")

    // A fresh account has no Profile yet — the onboarding gate's canonical signal (ADR 0001/0011).
    expect(me.isOnboarded).toBe(false)
    expect(me.profiles.length).toBe(0)

    // The users row was provisioned at sign-up, sharing the identity's primary key.
    const userRow = await testEnv.DB.prepare(`SELECT id FROM users WHERE id = ?`)
      .bind(me.id)
      .first<{ id: string }>()
    expect(userRow?.id).toBe(me.id)

    // username lives on identities (the credential), read live — never mirrored onto users.
    const identity = await testEnv.DB.prepare(`SELECT username FROM "identities" WHERE id = ?`)
      .bind(me.id)
      .first<{ username: string }>()
    expect(identity?.username).toBe("ada")
  })

  it("reflects the host role on the account", async () => {
    const cookie = await signInAs("chef", { role: "host" })
    expect((await showMe(cookie)).role).toBe("host")
  })
})
