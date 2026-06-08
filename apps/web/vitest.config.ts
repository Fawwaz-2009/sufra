import { defineConfig } from "vitest/config"

/**
 * Two test pools, coexisting as Vitest `projects`:
 *  1. `unit` — pure-Node tests (`*.test.ts`): no Worker, no live D1. Effect tests use
 *     `@effect/vitest` and swap services at the LAYER.
 *  2. `request` — in-process REQUEST tests (`*.request.test.ts`) INSIDE workerd via
 *     `@cloudflare/vitest-pool-workers`, over the REAL local D1 + KV. Lives in its own config file
 *     so it does NOT inherit the app's vite.config.ts (whose plugins break the workers pool).
 *
 * The patterns are disjoint, so each file lands in exactly one pool.
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["test/**/*.test.ts"],
          exclude: ["test/**/*.request.test.ts"]
        }
      },
      "./vitest.request.config.ts"
    ]
  }
})
