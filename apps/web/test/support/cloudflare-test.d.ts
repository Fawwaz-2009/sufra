/// <reference types="@cloudflare/vitest-pool-workers/types" />

/**
 * Type registration for the in-workerd REQUEST test pool. The triple-slash reference pulls in the
 * `declare module "cloudflare:test"` ambient (so `import { env, applyD1Migrations } from
 * "cloudflare:test"` typechecks under tsconfig.worker.json, which includes `test`).
 *
 * It also augments Vitest's `ProvidedContext` so `inject("migrations")` in the harness is typed
 * (the value is `provide`d in vitest.request.config.ts).
 */
import "vitest"

declare module "vitest" {
  interface ProvidedContext {
    migrations: Array<{ name: string; queries: string[] }>
  }
}
