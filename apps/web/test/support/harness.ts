import { applyD1Migrations, env } from "cloudflare:test"
import { getAuth } from "../../src/worker/app.ts"
import { serveBackend } from "../../src/worker/handler.ts"
import type { Bindings } from "../../src/worker/env.ts"

/**
 * In-process request harness — the analog of a Rails controller test. Boots the REAL backend
 * (`serveBackend`) over the REAL local D1 + KV that `@cloudflare/vitest-pool-workers` materializes
 * inside workerd, and drives endpoints in-process (no wrangler dev, no curl).
 */

/** `env` is `Cloudflare.Env` plus the app vars the pool injects (vitest.request.config.ts). */
export const testEnv = env as unknown as Bindings

/** The request origin the harness uses. MUST equal `BETTER_AUTH_URL` (Sufra trusts the request
 *  origin, so this matches trustedOrigins). */
export const ORIGIN = testEnv.BETTER_AUTH_URL

/** A valid password for seeded sign-ins (Better Auth's default min length is 8). */
const TEST_PASSWORD = "test-password-1234"

/** Apply `migrations/` to this test's isolated D1, once per suite (idempotent). */
export const migrateTestDb = async (): Promise<void> => {
  const { inject } = await import("vitest")
  await applyD1Migrations(testEnv.DB, inject("migrations"))
}

/**
 * Reset D1 + KV to empty (the DatabaseCleaner analog; call in beforeEach). This pool isolates
 * Durable Objects only, so D1/KV cleanup is ours. D1 has no interactive transactions → truncate.
 * KV holds sessions (Better Auth secondaryStorage), so a signed-in session would otherwise leak.
 */
export const cleanDb = async (): Promise<void> => {
  const tables = await testEnv.DB.prepare(
    `SELECT name FROM sqlite_master
     WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name <> 'd1_migrations'`
  ).all<{ name: string }>()
  for (const { name } of tables.results) {
    await testEnv.DB.prepare(`DELETE FROM "${name}"`).run()
  }

  let cursor: string | undefined
  do {
    const page = await testEnv.KV.list(cursor ? { cursor } : undefined)
    await Promise.all(page.keys.map((k) => testEnv.KV.delete(k.name)))
    cursor = page.list_complete ? undefined : page.cursor
  } while (cursor !== undefined)
}

const request = (path: string, init?: RequestInit): Request => new Request(new URL(path, ORIGIN), init)

/** Drive `serveBackend(req, env)` directly — the exact entry the Worker uses. */
export const call = async (path: string, init?: RequestInit): Promise<Response> => {
  const response = await serveBackend(request(path, init), testEnv)
  if (response === undefined) throw new Error(`backend did not claim ${path} — not an /api route?`)
  return response
}

export const postJson = (path: string, body: unknown, cookie?: string): Promise<Response> =>
  call(path, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN, ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body)
  })

export const get = (path: string, cookie?: string): Promise<Response> =>
  call(path, { headers: cookie ? { cookie } : {} })

export const patchJson = (path: string, body: unknown, cookie?: string): Promise<Response> =>
  call(path, {
    method: "PATCH",
    headers: { "content-type": "application/json", origin: ORIGIN, ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body)
  })

export const del = (path: string, cookie?: string): Promise<Response> =>
  call(path, { method: "DELETE", headers: cookie ? { cookie } : {} })

/** Bodyless POST helper (for reified toggle resources like saved). */
export const post = (path: string, cookie?: string): Promise<Response> =>
  call(path, { method: "POST", headers: { origin: ORIGIN, ...(cookie ? { cookie } : {}) } })

/** Collapse a Response's Set-Cookie header(s) into a replayable `cookie` request header. */
const cookieHeaderFrom = (response: Response): string | undefined => {
  const lines =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : (response.headers.get("set-cookie")?.split(/,(?=[^ ;]+=)/) ?? [])
  const pairs = lines
    .map((line) => line.split(";")[0]?.trim())
    .filter((pair): pair is string => pair !== undefined && pair.length > 0)
  return pairs.length > 0 ? pairs.join("; ") : undefined
}

/**
 * Create an account and sign it in, IN-PROCESS, returning a replayable session cookie. Public
 * sign-up is disabled, so the identity is created via the internal `signUpEmail` (the same path
 * Setup + admin.createUser use) — which fires the user.create.after hook that provisions the `users`
 * row. Then sign in via the username plugin's route to get the cookie. `role: "host"` flips the
 * identity to host before sign-in (so the session carries it).
 */
export const signInAs = async (username: string, opts?: { role?: "host" | "member" }): Promise<string> => {
  await getAuth(testEnv).api.signUpEmail({
    body: {
      email: `${username}@sufra.local`,
      password: TEST_PASSWORD,
      name: username,
      username
    }
  })
  if (opts?.role === "host") {
    await testEnv.DB.prepare(`UPDATE "identities" SET "role" = 'host' WHERE "username" = ?`).bind(username).run()
  }
  const signedIn = await postJson("/api/auth/sign-in/username", { username, password: TEST_PASSWORD })
  if (!signedIn.ok) throw new Error(`sign-in/username failed: ${signedIn.status} ${await signedIn.text()}`)
  const cookie = cookieHeaderFrom(signedIn)
  if (cookie === undefined) throw new Error("sign-in succeeded but set no cookie")
  return cookie
}
