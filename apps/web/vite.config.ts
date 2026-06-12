import { cloudflare } from "@cloudflare/vite-plugin"
import { defineConfig } from "vite"

/**
 * Worker-only build (ADR 0021 — the SPA is retired; Expo is the only client). The Cloudflare
 * plugin compiles src/server.ts + src/worker; there are no client assets to bundle.
 */
export default defineConfig({
  plugins: [cloudflare()],
})
