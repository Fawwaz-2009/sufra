---
name: exploration-canvas
description: >-
  An infinite canvas for AI-driven exploration. Renders a project's file tree of
  live artifacts — HTML pages, React SPAs, markdown documents, reference images —
  as zoomable, rearrangeable tiles (built on tldraw). Use when exploring product,
  design, or prototype directions; building moodboards; de-risking an idea; or
  laying out several variations side by side. You create artifacts as FILES via
  the `canvas` CLI (never by hand-editing JSON); a human arranges them on the
  canvas; the file tree stays the source of truth and the canvas updates live.
---

# Exploration Canvas

A spatial workbench for exploring ideas as code. Each artifact is a real folder on
disk; the canvas is just a live projection over the file tree.

## When to reach for it
Open-ended, divergent work where seeing things side by side helps: UI/design
directions, clickable prototypes, integration spikes, brand/narrative, pricing or
strategy writeups, reference moodboards. Not for single deliverables — for
*exploring options*.

## Mental model (read this first)
- **The file tree is the source of truth.** One artifact = one folder under
  `artifacts/<id>/` containing its content + a `frame.json` (its tile metadata).
- **The canvas is a projection.** It renders each artifact as a tile, live. When
  you change files, the canvas updates automatically (no reload). When the human
  drags/resizes a tile, its `frame.json` updates on disk.
- **You drive through files, the human drives on the canvas.** You scaffold and
  write artifacts; they arrange, group, annotate, and react.

## The one rule
**Never hand-edit `canvas.json` or any `frame.json`.** Use the `canvas` CLI —
it does the mechanical parts (folders, JSON, placement, the responsive
boilerplate) correctly every time, and the live canvas picks the change up.

## Setup (once per project)
Copy `reference/canvas/` into the project as `.canvas/`, then:
```bash
cd .canvas
npm install
node bin/canvas.mjs init --blank   # start clean (clears the bundled Ember demo)
npm run dev                        # serves http://localhost:5173
```
Tell the human to open that URL. Then create artifacts from `.canvas/` with:
```bash
node bin/canvas.mjs <verb> ...
```

## Creating artifacts
1. **Choose the lightest medium that achieves the objective** (your judgment):
   - `html` — the default. Static page, mockup, marketing/landing, anything you
     can express in one HTML file.
   - `spa` — only when you need real interactivity/state (React via CDN).
   - `document` — a markdown writeup (positioning, spec, notes); renders as a
     formatted, scrollable tile.
   - images — drop reference images directly onto the canvas (tldraw handles them
     natively), or place an image file under an artifact folder.
2. **Scaffold it** (creates the folder, `frame.json`, a correct responsive
   skeleton, and registers it):
   ```bash
   node bin/canvas.mjs scaffold <id> --tier html|spa|document --title "..." [--near <relatedId>]
   ```
3. **Write the real content** into the scaffolded file
   (`artifacts/<id>/index.html` or `document.md`). The tile updates live.

### Content conventions (the skeleton already follows these — don't undo them)
- Artifacts are **responsive, scrollable pages**: `html,body,#root{height:100%}`,
  `min-height:100%`, never `overflow:hidden` on the body, `min-height:0` on any
  flex child that should scroll. This lets a tile resize and scroll cleanly.
- Make them **distinct and real** — actual copy, not lorem; tasteful, not generic.

## Exploring spatially (your judgment, the CLI does the mechanics)
- `node bin/canvas.mjs place <id> --near <otherId>` — sit a tile beside a related one.
- `node bin/canvas.mjs fork <id> --as <newId>` — branch a direction to remix it.
- `node bin/canvas.mjs link <from> <to> --label "..."` — draw a relationship arrow.
- `node bin/canvas.mjs list` — see what exists and where.
- `node bin/canvas.mjs rm <id>` — remove an artifact.
Cluster related explorations near each other; fork to try a variation without
losing the original; link to show flow.

## Reading the canvas
The human arranges tiles to signal intent (e.g. clustering the directions they
like). You can read every tile's position from its `frame.json`, and the live
state from `canvas.json`.

## What is code vs. what is you
The CLI + canvas app (in `.canvas/`) handle everything deterministic — rendering,
serving, file-sync, placement, the JSON. **You handle the judgment**: what to
explore, which medium, the actual content, and how to arrange it.
