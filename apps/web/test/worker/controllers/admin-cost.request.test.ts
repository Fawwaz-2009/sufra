import { describe, expect, it } from "vitest"
import { get, postJson, signInAs } from "../../support/harness.ts"

/**
 * Admin cost over real D1 (ADR 0013) — the inference-spend rollup, host-only + instance-wide. Summed from
 * the decoupled `inference_runs` audit (empty here → a clean zero rollup). `memberCount` excludes the Host
 * (CONTEXT: a Member is a provisioned account, the Host is not one), matching the admin member list. A
 * non-host gets a uniform 404.
 */

const RANGE = "from=2026-06-01T00:00:00.000Z&to=2026-07-01T00:00:00.000Z"

type Cost = { totalUsd: number; runCount: number; memberCount: number; perMemberAvgUsd: number }

const cost = async (cookie: string): Promise<Cost> =>
  (await (await get(`/api/admin/cost?${RANGE}`, cookie)).json()) as Cost

describe("Admin cost (request)", () => {
  it("404s for a non-host", async () => {
    const member = await signInAs("kid")
    expect((await get(`/api/admin/cost?${RANGE}`, member)).status).toBe(404)
  })

  it("returns a zeroed, Host-excluding rollup that counts only Members", async () => {
    const host = await signInAs("chef", { role: "host" })

    // No Members yet → memberCount 0 (the Host is not a Member).
    const empty = await cost(host)
    expect(empty.totalUsd).toBe(0)
    expect(empty.runCount).toBe(0)
    expect(empty.memberCount).toBe(0)
    expect(empty.perMemberAvgUsd).toBe(0)

    // Provision a Member → memberCount becomes 1 (still excludes the Host).
    await postJson("/api/admin/members", { username: "kid" }, host)
    expect((await cost(host)).memberCount).toBe(1)
  })
})
