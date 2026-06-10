import { beforeAll, beforeEach } from "vitest"
import { cleanDb, migrateTestDb } from "./harness.ts"

/**
 * Shared setup for every request test (setupFiles in vitest.request.config.ts):
 *  - beforeAll  — apply `migrations/` to this file's test D1 (idempotent).
 *  - beforeEach — reset D1 + KV to a clean slate (this pool isolates Durable Objects only, so
 *    D1/KV cleanup is ours — the DatabaseCleaner analog).
 */
beforeAll(async () => {
  await migrateTestDb()
})

beforeEach(async () => {
  await cleanDb()
})
