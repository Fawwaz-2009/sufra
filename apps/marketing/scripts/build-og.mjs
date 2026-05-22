#!/usr/bin/env node
// apps/marketing/scripts/build-og.mjs
//
// Generates the Sufra Open Graph card (1200×630 PNG) shared across the
// marketing site and the deployed app. Run once; commit the PNG; regen
// when the design changes.
//
//   node apps/marketing/scripts/build-og.mjs
//
// The card is the brand impression that appears every time a Host pastes
// a password-link in WhatsApp/iMessage, or the marketing URL is shared
// anywhere with link previews. WhatsApp downscales to ~300×200 and
// imposes a 300KB cap; we aim well under both.

import { readFile, writeFile } from "node:fs/promises"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"

const __dirname = dirname(fileURLToPath(import.meta.url))
const MARKETING_PUBLIC = resolve(__dirname, "..", "public")
const WEB_PUBLIC = resolve(__dirname, "..", "..", "web", "public")
const LOGO_PATH = resolve(MARKETING_PUBLIC, "sufra-mark.png")

// Brand tokens — pulled from the app's :root and the marketing tokens.css
// so the OG card is in lockstep with everything else.
const PAPER = "#FFFFFF"
const INK = "#1B1612" // ~oklch(0.147 0.004 49.3) → sRGB
const INK_SOFT = "#5A5046" // ~oklch(0.35 0.006 49.3) → sRGB
const MUTE = "#8C7D72" // ~oklch(0.547 0.021 43.1) → sRGB
const ACCENT = "#528C51" // ~oklch(0.527 0.154 150.069) → sRGB (forest green)

async function main() {
  const logoB64 = (await readFile(LOGO_PATH)).toString("base64")
  const logoDataUri = `data:image/png;base64,${logoB64}`

  // 1200×630 is the canonical OG aspect ratio. WhatsApp crops to near-square
  // around the centre, so the focal content (mark + wordmark) sits left/centred
  // and the tagline + colophon hang at the bottom edge.
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${PAPER}"/>

  <!-- Hairline rule at the top, terracotta-warm tradition -->
  <line x1="0" y1="0" x2="1200" y2="0" stroke="${ACCENT}" stroke-width="6"/>

  <!-- Logo glyph -->
  <image href="${logoDataUri}" x="84" y="120" width="160" height="160"/>

  <!-- Wordmark -->
  <text
    x="84" y="380"
    font-family="'Fraunces', 'Georgia', 'Times New Roman', serif"
    font-style="italic"
    font-weight="500"
    font-size="160"
    fill="${INK}"
    letter-spacing="-0.025em"
  >Sufra.</text>

  <!-- Tagline -->
  <text
    x="84" y="450"
    font-family="'Fraunces', 'Georgia', 'Times New Roman', serif"
    font-style="italic"
    font-weight="400"
    font-size="38"
    fill="${INK_SOFT}"
    letter-spacing="-0.005em"
  >A photo-first calorie tracker for the people at your table.</text>

  <!-- Colophon row at the bottom -->
  <line x1="84" y1="546" x2="1116" y2="546" stroke="${ACCENT}" stroke-width="1" opacity="0.35"/>

  <text
    x="84" y="588"
    font-family="'Raleway', 'Helvetica Neue', Helvetica, sans-serif"
    font-weight="500"
    font-size="22"
    fill="${MUTE}"
    letter-spacing="0.08em"
  >OPEN SOURCE · MIT · v0.1</text>

  <text
    x="1116" y="588"
    font-family="'Raleway', 'Helvetica Neue', Helvetica, sans-serif"
    font-weight="500"
    font-size="22"
    fill="${ACCENT}"
    letter-spacing="0.04em"
    text-anchor="end"
  >sufra.fawwaz.dev →</text>
</svg>
`

  const png = await sharp(Buffer.from(svg))
    .resize(1200, 630)
    .png({ compressionLevel: 9, quality: 90 })
    .toBuffer()

  const outputs = [
    resolve(MARKETING_PUBLIC, "og.png"),
    resolve(WEB_PUBLIC, "og.png"),
  ]

  for (const path of outputs) {
    await writeFile(path, png)
    console.log(`Wrote ${path}  (${(png.length / 1024).toFixed(1)} KB)`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
