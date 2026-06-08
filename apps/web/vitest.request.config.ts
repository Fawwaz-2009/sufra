import { fileURLToPath } from "node:url"
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers"
import { defineConfig } from "vitest/config"

/**
 * The `request` project — in-process REQUEST tests (`*.request.test.ts`) that run INSIDE workerd
 * via `@cloudflare/vitest-pool-workers`, over the REAL local D1 (`DB`) + KV (`KV`) + R2 (`BUCKET`)
 * bindings from wrangler.jsonc. The in-process analog of a Rails controller test.
 *
 * Separate config file (referenced by vitest.config.ts) on purpose: it must NOT inherit the app's
 * vite.config.ts (whose tanstack/cloudflare/pwa plugins don't resolve in the workers pool). A
 * standalone config with its own plugin list keeps the worker pool clean.
 */

// Read every migration in `migrations/` (Node side) to apply to the test D1 inside workerd via
// `applyD1Migrations`. Provided to the project through Vitest's `provide`/`inject`.
const migrations = await readD1Migrations(fileURLToPath(new URL("./migrations", import.meta.url)))

export default defineConfig({
  plugins: [
    cloudflareTest({
      // The worker `main`. NOT wrangler.jsonc's main (src/server.ts) — that falls through to the
      // ASSETS binding, absent in the pool. This frontend-free entry runs the same backend; tests
      // call `serveBackend` directly anyway.
      main: "./test/support/worker-entry.ts",
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        // The app vars Better Auth + the estimator need (wrangler.jsonc has none; .dev.vars is
        // dev-only). BETTER_AUTH_URL MUST equal the harness request origin or Better Auth rejects
        // it. ENVIRONMENT=test selects the test mode. No mail vars (no email), no R2 S3 creds (the
        // photo is served through the authenticated Worker proxy — no presigning).
        bindings: {
          BETTER_AUTH_SECRET: "test-only-secret-0123456789abcdef0123456789abcdef",
          BETTER_AUTH_URL: "http://localhost:8787",
          ENVIRONMENT: "test",
          OPENROUTER_API_KEY: "test-openrouter-key"
        }
      }
    })
  ],
  test: {
    name: "request",
    include: ["test/**/*.request.test.ts"],
    setupFiles: ["./test/support/setup.ts"],
    provide: { migrations }
  }
})
