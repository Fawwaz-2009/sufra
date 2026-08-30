# Infinite Canvas for AI-Driven Exploration — Founding Design Doc

*A spatial operating surface for the solo operator. The file tree is the source of truth; the canvas is only a view.*

> Derived from a background research workflow (7 parallel deep-dives + synthesis) on 2026-06-13. Status: **draft for discussion**. Decisions marked "pending confirmation" still need a human call.

## 1. TL;DR — Recommended Stack

Build a **single local Node "canvas host" process** that owns one origin (e.g. `localhost:5173`), serves a **React Flow (`@xyflow/react` v12, MIT)** canvas SPA, reads/writes a **two-tier file manifest** (`canvas.json` + per-artifact `frame.json`), and acts as a **path-routing reverse proxy** that lazy-spawns real local dev servers only for the full-stack tier. Tiles are real iframes positioned inside one transformed viewport; the agent edits small files and "sees" tiles via screenshots, never DOM dumps. Every load-bearing dependency is MIT/Apache — there is a fully-open path with **zero licensing landmines**, the decisive constraint for a redistributable skill.

- **Canvas library: React Flow / `@xyflow/react` v12 — MIT.** No watermark, no runtime license key, plain-React custom nodes inside one transformed viewport (live iframes pan/zoom natively), built-in `onlyRenderVisibleElements` virtualization. Handles 20–100 tiles comfortably. The only option satisfying *open-source + MIT + native live-HTML tiles + virtualization* at once. (tldraw is richer but **source-available, $6k/yr + watermark, prod license-key kill-switch** — rejected as base engine.)
- **In-browser runtime (SPA tier): Sandpack classic bundler — Apache-2.0, self-hostable `bundlerURL`.** Runs React/Vue/Svelte/Solid/Vanilla in-browser with zero per-tile process. (Avoid Sandpack **Nodebox** — non-commercial license, abandoned 2023. Avoid **WebContainers** — closed-source, CDN-locked at boot, Chromium-only, paid commercial.)
- **Dev orchestration (full-stack tier): real local Node child process, lazy-spawned, idle-stopped.** One child dev server per full-stack artifact, hard-capped at 3–5 concurrent live (LRU eviction), ~0.5–1 GB RAM each. License-clean and more capable than any in-browser Node runtime.
- **Reverse proxy: `http-proxy-3` — MIT, maintained, WebSocket-capable.** Routes `/_artifact/<id>/*` → `127.0.0.1:<port>` with `ws:true`. Single origin kills CORS, enables client-side screenshots, lets you strip `X-Frame-Options`/`frame-ancestors`.
- **Snapshot strategy: three-state tiles (cold `<img>` / warm `<img>` / hot live-iframe)**, driven by IntersectionObserver + `content-visibility:auto`. Client-side `modern-screenshot` (MIT) for same-origin HTML/SPA tiles; **Playwright (Apache-2.0)** headless for full-stack tiles and as fallback. Never show a live iframe below ~1:1 zoom (scale-blur) — swap to the sharp snapshot.
- **Manifest: two-tier JSON, JSON-Canvas-compatible field names (MIT spec).** `canvas.json` owns membership + edges + groups + viewport; each `artifacts/<id>/frame.json` owns its own position + tier + runtime + thumbnail. Small diffs, clean forks (`cp -r`), free Obsidian `.canvas` export.

## 2. Prior-Art Verdict: Whitespace at the Intersection

**No exact clone exists.** Genuine whitespace at the intersection of four requirements, surrounded by fast-moving near-misses. The defensible moat is the **live tiered-runtime artifact projection over a real file tree** — *not* "canvas + agent," which is already commoditized.

**Closest analog: Paper.design** (https://paper.design/blog/a-real-space-to-design-in-the-age-of-agents) — nearly identical thesis ("if the canvas is built on html, css, dom, you're working in the medium"), MCP-driven, works with Claude Code. **What it gets wrong:** closed-source *design tool* (GPU-shader canvas), unit of work is a design not "any file rendered live," UI-design-only (not product/sales/narrative/full-stack side-by-side), and its MCP round-trips push design state through context — the heavyweight Figma-MCP pattern we reject.

**Runner-up near-misses, each failing one pillar:**
- **Pencil.dev** — file-in-git + infinite WebGL canvas + Claude Code + parallel agents, but `.pen` is a **vector scene-graph** (static mockups, no live running HTML/React/iframes). *Our differentiator: real live running artifacts vs vector mockups.*
- **Cognograph** (AGPL-3.0) — renders live HTML/code/3D on canvas, but the **spatial graph is the DB (IndexedDB)**, filesystem explicitly *not* source of truth — the inverse of our core principle.
- **Agent-HTML** (Apache-2.0, https://github.com/Sayhi-bzb/Agent-HTML) — closest OSS *philosophy* match (filesystem-durable, `artifacts/` folder, Vite "Canvas host"), but explicitly *not* a true infinite canvas and React-only.

**Decisive observation:** nobody has unified "file tree = source of truth" WITH "live multi-artifact spatial canvas," and **the tiered runtime (HTML→SPA→full-stack reverse-proxy) is nowhere in the field.**

**Platform risk** is real but not from clones: Anthropic's own **Claude Design** (Apr 2026), Paper, and Pencil are converging on "agent + canvas + HTML-as-medium." Move on the *live + tiered + general-purpose* angle.

## 3. How Each Tier Resolves to a URL (End-to-End)

The single origin is the load-bearing decision: the manifest only ever stores an `id`, never a port. Everything resolves under `localhost:5173/_artifact/<id>/`.

| Tier | Runtime | What serves it | URL | Process cost |
|---|---|---|---|---|
| **HTML (default)** | none | Canvas host serves the file statically (or `srcdoc` inline) | `/_artifact/<id>/index.html` | **0** |
| **SPA (React/Vue/Svelte)** | in-browser | Sandpack bundler iframe (self-hosted `bundlerURL`) | `/_artifact/<id>/` | **0** |
| **Full-stack / Node** | real local process | per-artifact Vite/Next child server, reverse-proxied | `/_artifact/<id>/` | **1 child (lazy)** |

**HTML tier:** Host serves the artifact folder's `entry` file directly; tiny artifacts can inline via iframe `srcdoc` (zero round-trip). Snapshot via client-side `modern-screenshot`.

**SPA tier:** Host mounts a Sandpack bundler iframe pointed at a self-hosted bundler; Sandpack transpiles + bundles in-browser. No dev server, no process. (Deps resolve via CDN; self-host a registry mirror for true offline.)

**Full-stack tier:** On `focus(id)`, host spawns a child Vite server with `base:'/_artifact/<id>/'`, waits for ready, allocates a port (child binds via `strictPort` + range and reports its actual port back — avoids the `get-port` race), routes `/_artifact/<id>/*` → `127.0.0.1:<port>` through `http-proxy-3` (`ws:true`). On blur/idle, snapshot via Playwright, kill the child. **#1 de-risker (see §8):** HMR-over-path-proxy needs `server.hmr.path:'/_artifact/<id>/hmr'` + `hmr.clientPort:5173` + `hmr.protocol:'ws'` + `allowedHosts:['localhost','127.0.0.1']`, or Vite's HMR socket falls back to the child port and breaks the single-origin guarantee.

## 4. Canvas-Library Decision (License Tradeoff, Bluntly)

**Recommendation: React Flow / `@xyflow/react` v12 (MIT).** *(pending confirmation)*

The architectural fork is **DOM-vs-canvas**, and it decides everything: this is a **DOM-overlay problem, not a vector-drawing problem.** DOM engines (React Flow, tldraw) make a live iframe "just work" inside a single CSS-transformed viewport. Canvas/WebGL engines (Konva, Fabric) **cannot render DOM/iframes natively** — disqualified.

- **React Flow (MIT) ⭐** — No watermark, no key; "Pro" is optional paid *support*, not a gate. Custom nodes are plain React (iframe-in-node fully supported); `onlyRenderVisibleElements` gives virtualization. Use it purely as a positioned-tile viewport; ignore edges/handles. Cost: you hand-build LOD and the lock/pointer model.
- **tldraw (source-available) — technically best, license-blocked.** Only engine with a real track record of live-app-tiles + on-canvas AI agents (`HTMLContainer` shapes, LOD `indicator()`). **But SDK 4.0 enforces a runtime license key: free on localhost/dev, but production (non-localhost HTTPS + `NODE_ENV=production`) needs a key or shows a "made with tldraw" watermark; commercial is $6,000/yr.** Reserve as an optional paid "premium engine" path.
- **Excalidraw (MIT) — open fallback.** Allow-all iframes via `validateEmbeddable`, but whiteboard-first with no first-class arbitrary-React-shape API; worse for precise programmatic tiles.
- **Konva / Fabric (MIT) — wrong tool.** No native DOM/iframe rendering.
- **Penpot (MPL-2.0) — exclude.** Full design *application* with its own backend/DB; reintroduces the heavyweight pattern we reject.

**Blunt tradeoff:** tldraw buys polished canvas UX + proven AI-on-canvas patterns at the cost of a $6k/yr-or-watermark gate; React Flow gives up some polish (hand-built LOD) but keeps the whole stack MIT and redistributable. For a tool others run and redistribute, **MIT wins.**

## 5. The Single Biggest De-Risker — and Where It Stops

**Sandpack's Apache-2.0 in-browser bundler** *fully erases* the dev-server-per-artifact problem for the **entire static + SPA tier** — the common case. Open-source, self-hostable, commercial-safe, fits "mount live iframe only on focus." With HTML tier (zero infra) + SPA tier (zero process), the **vast majority of tiles cost no local processes at all.**

**Where it stops:** Sandpack is a *bundler, not Node* — no SSR, no API routes, no real FS, no real `npm install`, no native modules, no DB. The moment an artifact needs **real Node / Vite-dev / Next SSR / API routes / a database / native addons**, Sandpack can't help — and neither can any open-source local-first in-browser Node runtime (WebContainers = closed-source, CDN-locked, paid; Nodebox = non-commercial, abandoned). **Therefore the full-stack tier MUST be a real local spawned process behind the reverse proxy** — license facts make it mandatory, and it's more capable anyway.

## 6. Prior Art to Copy From

**Philosophy anchor — Anthropic's "HTML as a medium":** *"Using Claude Code: The Unreasonable Effectiveness of HTML"* by Thariq Shihipar (Anthropic), May 2026 — https://claude.com/blog/using-claude-code-the-unreasonable-effectiveness-of-html (Simon Willison's analysis: https://simonwillison.net/2026/May/8/unreasonable-effectiveness-of-html/). Thesis: Markdown gives something to *read*, HTML gives something to *use* — the default artifact should be a self-contained HTML file. Validates "HTML is the default tier." (The essay says *nothing* about a spatial canvas — the projection idea is ours.)

- **Onlook** (Apache-2.0) — steal its instrument-code-to-locate-element + edit-in-iframe-then-write-to-source loop. Avoid its React/Tailwind lock-in + single-app tree.
- **tldraw "Make Real"** — steal the loop: canvas selection → screenshot + text → vision model → HTML → iframe back on canvas, with arrow/note annotation for re-iteration. This *is* our "agent sees tiles via screenshots" pattern, validated. Steal the branching-canvas philosophy (source left, results right).
- **`yctimlin/mcp_excalidraw`** (MIT) — steal the Claude-skill layout (`SKILL.md` + `references/` + `scripts/*.cjs`) and the `get_canvas_screenshot` + `describe_scene` loop. Avoid in-memory storage.
- **`talhaorak/tldraw-mcp`** (MIT) — steal the path-traversal-guarded file⟷canvas read/write sync mechanics.
- **JSON Canvas / Obsidian** (MIT, https://jsoncanvas.org/spec/1.0/) — steal the tiny-manifest-over-real-files format + field names for free `.canvas` interop.
- **Dyad** (Apache-2.0) — validation that a local OSS app builder spawning real local processes + real infra works with no sign-up.
- **v0 / Vercel Sandbox** — server-side previews need a real VM/process, not a browser sandbox.
- **Storybook / Ladle** (MIT) — iframe-isolation + single-manager UX (one host, every unit in an isolated iframe, postMessage).
- **OpenCove** (MIT, `@xyflow`/`xterm`/`node-pty`) — multi-agent + reverse-proxy process-orchestration reference; confirms xyflow as the right open base.

## 7. Manifest Schema + Agent-Facing Skill Contract

**Don't store shapes. Store the minimum spatial projection over the file tree.** Two tiers keep global layout and per-artifact metadata small and independently editable.

### `canvas.json` (one per repo root) — membership + edges + groups + viewport

```jsonc
{
  "schema": "infinite-canvas/1",
  "version": 1,
  "viewport": { "x": 0, "y": 0, "zoom": 1 },
  "grid": { "snap": 20 },
  "artifacts": [
    { "id": "auth-flow", "path": "artifacts/auth-flow" }  // ref only; position in frame.json
  ],
  "edges": [
    { "id": "e1", "from": "auth-flow", "to": "dashboard",
      "fromSide": "right", "toSide": "left", "toEnd": "arrow", "label": "navigates to" }
  ],
  "groups": [
    { "id": "g-sales", "label": "Sales narrative", "members": ["pitch","pricing"], "color": "6" }
  ]
}
```

### `artifacts/<id>/frame.json` (one per artifact) — the tile descriptor

```jsonc
{
  "schema": "infinite-canvas-frame/1",
  "id": "auth-flow",
  "title": "Auth flow",
  "frame": { "x": 1200, "y": 400, "w": 480, "h": 320 },  // position = source of truth
  "tier": "html",                  // html | spa | fullstack
  "entry": "index.html",           // file rendered in the iframe
  "runtime": {                     // present only when tier != html
    "framework": "vite-react",
    "dev": "npm run dev",
    "port": null,                  // assigned at lazy-start
    "idleStopSec": 120
  },
  "thumbnail": "thumb.png",        // zoomed-out tile = the agent's "screenshot" view
  "thumbnailHash": "sha256:…",     // invalidate snapshot when entry changes
  "forkedFrom": "auth-flow@a1b2",  // provenance
  "tags": ["product", "ui"],
  "status": "draft"                // draft | review | shipped
}
```

**Why this shape:** JSON-Canvas field names (free Obsidian export); `frame.json` lives *inside* the folder so fork = `cp -r` and move = one-field edit; `tier`/`entry`/`runtime` encode the runtime ladder declaratively so the **host** (not the agent) decides static-serve vs Sandpack vs spawn-and-proxy; `thumbnail`+`thumbnailHash` is the cheap-context mechanism (agent reads a PNG, never the DOM).

### Claude-skill agent-facing contract

Package as a standard skill folder (`SKILL.md` + `scripts/` + `references/schema.json`), progressive disclosure. **Prefer file edits + thin idempotent CLI scripts over a stateful MCP server** — that's the whole thesis, and it avoids the scene-state re-injection bloat the prior art suffered.

| Verb | Mechanism | What it does |
|---|---|---|
| `scaffold <id> --tier html` | script writes `{entry, frame.json}`, appends to `canvas.json`, calls `place` | create artifact + manifest entry |
| *(edit artifact)* | plain Write/Edit on `artifacts/<id>/index.html` | the actual work — no canvas API touched |
| `place <id> [--near <id>\|--xy]` | script finds empty space, writes `frame.x/y` | non-overlapping placement |
| `move <id> --xy` | one-field Edit of `frame.json` | reposition tile |
| `fork <id> [--as <newid>]` | `cp -r` folder, rewrite `id`, set `forkedFrom`, `place` offset | remix a tile |
| `link <from> <to> [--label]` | append edge to `canvas.json` | draw a relation arrow |
| `snapshot <id>` | host renders `entry`, writes `thumbnail` + `thumbnailHash` | refresh the agent's screenshot view |
| `escalate <id> --tier spa\|fullstack` | rewrite `frame.json` runtime block, scaffold build files | climb the runtime ladder only on real need |

**Contract invariants (state in `SKILL.md`):** (1) Never dump the canvas into context — read a tile's `thumbnail` to understand, open its `entry` to edit, read manifests only for spatial ops. (2) `frame.json` owns position; `canvas.json` owns membership/edges/viewport. (3) HTML is the default; escalate only on explicit need. (4) All scripts idempotent + validate against `references/schema.json`.

## 8. Open Risks / Unknowns Worth a Spike

1. **HMR-over-path-proxy (HIGHEST RISK — spike first, before building the canvas).** Prototype the `base` + `hmr.path` + `hmr.clientPort` + `hmr.protocol` + `allowedHosts` + `strictPort` combo on one full-stack artifact end-to-end. Vite doesn't honor relative `base` and its HMR socket falls back to a direct child-port connection if the proxied WS fails — silently breaking single-origin. If this doesn't work cleanly, the whole full-stack tier is at risk.
2. **Live-iframe memory ceiling.** Site Isolation = one renderer process per cross-origin iframe; each full-stack Vite dev server is ~0.5–1 GB. Enforce a small hot-iframe pool + hard concurrent-live cap (3–5) + LRU eviction. Spike the real ceiling on the target machine.
3. **`scale()` blur on live iframes.** Browsers raster a transformed iframe at natural scale then GPU-scale; no developer control. Mitigation is the snapshot swap — verify cold→hot→cold feels seamless and snapshots are sharp at all zooms.
4. **Snapshot freshness vs cost.** Client-side `modern-screenshot` only reaches *same-origin* iframes (cross-origin taints the canvas) — *why* the reverse proxy is non-negotiable. Full-stack tiles must be running to snapshot. Spike the `thumbnailHash` invalidation + lazy-snapshot-on-blur loop.
5. **Concurrent manifest writes.** Agent and human both moving tiles can clobber `canvas.json`. Per-artifact `frame.json` positions isolate most of it; consider append-only edges + last-writer-wins on viewport. Spike a concurrent-edit scenario.
6. **Folder-rename = id churn.** Keep `id` stable and decoupled from `path` so renaming a folder doesn't break edges/forks.
7. **Child reaping / orphaned servers.** Spawn children with process-group handling; reap the tree on host exit so dev servers don't squat ports. Spike host-crash recovery.
8. **Self-hosted Sandpack bundler offline cold-start.** Sandpack resolves deps via CDN; true air-gap needs a self-hosted bundler + local registry mirror. Spike whether the offline story holds.
9. **Platform/competitive pressure.** Claude Design, Paper, Pencil converging fast. Front-load the unique moat (live tiered-runtime artifacts) over the commoditized canvas-plus-agent shell.
