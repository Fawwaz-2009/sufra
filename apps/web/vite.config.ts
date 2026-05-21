import path from "path"
import { cloudflare } from "@cloudflare/vite-plugin"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import { defineConfig } from "vite"
import { VitePWA } from "vite-plugin-pwa"

export default defineConfig({
  plugins: [
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      pwaAssets: {
        // Custom preset — the default "minimal-2023" adds 30% padding around
        // the source artwork and fills the bleed with transparent (for "any")
        // or white (for "maskable"), which on Android renders as a white
        // square/circle behind the icon. Our favicon.png is designed
        // full-bleed (colored to the corners), so we set padding: 0 and let
        // the source go edge-to-edge.
        image: "public/favicon.png",
        preset: {
          transparent: {
            sizes: [64, 192, 512],
            favicons: [[48, "favicon.ico"]],
            padding: 0,
            resizeOptions: { fit: "cover", background: "transparent" },
          },
          maskable: {
            sizes: [512],
            padding: 0,
            // Android crops maskable icons to whatever shape the launcher
            // uses (usually a circle). With padding 0, the source's own
            // corners are what get cropped — fine because the source's
            // edges are decorative background, not glyph content.
            resizeOptions: { fit: "cover" },
          },
          apple: {
            sizes: [180],
            padding: 0,
            resizeOptions: { fit: "cover" },
          },
        },
      },
      manifest: {
        name: "Sufra",
        short_name: "Sufra",
        description: "Photo-first calorie tracking for the people at your table.",
        theme_color: "#0c0a09",
        background_color: "#0c0a09",
        display: "standalone",
        start_url: "/",
        scope: "/",
        lang: "en",
        dir: "ltr",
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff,woff2}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^\/api\//,
            handler: "NetworkOnly",
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
    cloudflare(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
