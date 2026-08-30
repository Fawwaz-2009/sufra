#!/usr/bin/env node
// The `canvas` CLI — deterministic manifest operations over the file tree.
// The agent calls these instead of hand-editing canvas.json / frame.json, so
// the mechanical parts (folders, JSON, placement, responsive boilerplate) are
// always correct. The live canvas picks up the file changes automatically.
//
//   canvas scaffold <id> [--tier html|spa|document] [--title "..."] [--near <id>] [--size WxH]
//   canvas place    <id> (--xy X,Y | --near <id>)
//   canvas fork     <id> [--as <newId>] [--title "..."]
//   canvas link     <from> <to> [--label "..."]
//   canvas rm       <id>
//   canvas list
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const ARTIFACTS = path.join(ROOT, 'artifacts')
const CANVAS = path.join(ROOT, 'canvas.json')
const GAP = 40

// ---- tier presets ----------------------------------------------------------
const TIERS = {
  html: { kind: 'html', entry: 'index.html', tier: 'html', size: [520, 640] },
  spa: { kind: 'spa', entry: 'index.html', tier: 'spa', size: [480, 420] },
  document: { kind: 'document', entry: 'document.md', tier: 'static', size: [440, 520] },
}

// ---- templates (responsive convention baked in) ----------------------------
const tmpl = {
  html: (t, id) => `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${t}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  /* responsive: fill the tile, scroll if content overflows (never fixed px) */
  html,body{height:100%;width:100%}
  body{min-height:100%;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#1a1a1d;background:#fff;padding:28px}
  h1{font-size:24px;margin-bottom:10px}
  p{color:#6b6b72;line-height:1.5}
</style>
</head>
<body>
  <h1>${t}</h1>
  <p>New html tile — edit <code>artifacts/${id}/index.html</code>.</p>
</body>
</html>
`,
  spa: (t, id) => `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${t}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  /* responsive: #root must have height so flex layouts fill + scroll correctly */
  html,body,#root{height:100%;width:100%}
  body{min-height:100%;font-family:system-ui,sans-serif;color:#1a1a1d}
</style>
</head>
<body>
<div id="root"></div>
<script type="module">
  import React, { useState } from "https://esm.sh/react@18";
  import { createRoot } from "https://esm.sh/react-dom@18/client";
  import htm from "https://esm.sh/htm@3.1.1";
  const html = htm.bind(React.createElement);
  function App() {
    const [n, setN] = useState(0);
    return html\`<div style=\${{ padding: 28 }}>
      <h1>${t}</h1>
      <button onClick=\${() => setN(n + 1)}>clicked \${n}</button>
    </div>\`;
  }
  createRoot(document.getElementById("root")).render(html\`<\${App} />\`);
</script>
</body>
</html>
`,
  document: (t) => `# ${t}

A new document — write markdown here. It renders as a scrollable tile.
`,
}

// ---- helpers ---------------------------------------------------------------
function die(msg) {
  console.error('✗ ' + msg)
  process.exit(1)
}
function readCanvas() {
  if (!fs.existsSync(CANVAS)) return { schema: 'infinite-canvas/1', version: 1, artifacts: [], groups: [], edges: [] }
  return JSON.parse(fs.readFileSync(CANVAS, 'utf8'))
}
function writeCanvas(c) {
  fs.writeFileSync(CANVAS, JSON.stringify(c, null, 2) + '\n')
}
function writeJSON(file, obj) {
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n')
}
function readFrame(id) {
  const f = path.join(ARTIFACTS, id, 'frame.json')
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null
}
function allFrames(canvas) {
  return canvas.artifacts.map((a) => readFrame(a.id)).filter((f) => f && f.frame)
}
// find a non-overlapping spot: beside `near` if given, else right of everything
function findSpot(canvas, w, h, near) {
  if (near) {
    const nf = readFrame(near)
    if (nf?.frame) return { x: nf.frame.x + nf.frame.w + GAP, y: nf.frame.y }
  }
  const frames = allFrames(canvas)
  if (!frames.length) return { x: 0, y: 0 }
  const maxRight = Math.max(...frames.map((f) => f.frame.x + f.frame.w))
  return { x: maxRight + GAP, y: 0 }
}
function parseFlags(args) {
  const pos = []
  const flags = {}
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) flags[args[i].slice(2)] = args[i + 1]?.startsWith('--') || args[i + 1] === undefined ? true : args[++i]
    else pos.push(args[i])
  }
  return { pos, flags }
}

// ---- commands --------------------------------------------------------------
function scaffold(args) {
  const { pos, flags } = parseFlags(args)
  const id = pos[0]
  if (!id || !/^[a-z0-9][a-z0-9-]*$/.test(id)) die('scaffold <id>  (id: lowercase, kebab-case)')
  const dir = path.join(ARTIFACTS, id)
  if (fs.existsSync(dir)) die(`artifact "${id}" already exists`)
  const tierName = flags.tier || 'html'
  const preset = TIERS[tierName]
  if (!preset) die(`unknown tier "${tierName}" (html | spa | document)`)
  const title = flags.title || id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  let [w, h] = preset.size
  if (typeof flags.size === 'string' && /^\d+x\d+$/.test(flags.size)) [w, h] = flags.size.split('x').map(Number)

  const canvas = readCanvas()
  const { x, y } = flags.xy ? xy(flags.xy) : findSpot(canvas, w, h, flags.near)

  fs.mkdirSync(dir, { recursive: true })
  writeJSON(path.join(dir, 'frame.json'), {
    schema: 'infinite-canvas-frame/1',
    id,
    title,
    kind: preset.kind,
    entry: preset.entry,
    frame: { x, y, w, h },
    tier: preset.tier,
    tags: [],
    status: 'draft',
  })
  fs.writeFileSync(path.join(dir, preset.entry), tmpl[tierName](title, id))
  if (!canvas.artifacts.find((a) => a.id === id)) canvas.artifacts.push({ id, path: `artifacts/${id}` })
  writeCanvas(canvas)
  console.log(`✓ scaffolded ${tierName} tile "${id}" at (${x},${y}) — edit artifacts/${id}/${preset.entry}`)
}

function xy(s) {
  const [x, y] = String(s).split(',').map(Number)
  return { x, y }
}

function place(args) {
  const { pos, flags } = parseFlags(args)
  const id = pos[0]
  const frame = readFrame(id)
  if (!frame) die(`no artifact "${id}"`)
  let p
  if (flags.xy) p = xy(flags.xy)
  else if (flags.near) {
    const nf = readFrame(flags.near)
    if (!nf) die(`no artifact "${flags.near}"`)
    p = { x: nf.frame.x + nf.frame.w + GAP, y: nf.frame.y }
  } else die('place <id> (--xy X,Y | --near <id>)')
  frame.frame.x = p.x
  frame.frame.y = p.y
  writeJSON(path.join(ARTIFACTS, id, 'frame.json'), frame)
  console.log(`✓ placed "${id}" at (${p.x},${p.y})`)
}

function fork(args) {
  const { pos, flags } = parseFlags(args)
  const src = pos[0]
  const srcDir = path.join(ARTIFACTS, src)
  if (!fs.existsSync(srcDir)) die(`no artifact "${src}"`)
  const newId = flags.as || `${src}-copy`
  const dstDir = path.join(ARTIFACTS, newId)
  if (fs.existsSync(dstDir)) die(`artifact "${newId}" already exists`)
  fs.cpSync(srcDir, dstDir, { recursive: true })
  const frame = readFrame(newId)
  frame.id = newId
  if (flags.title) frame.title = flags.title
  frame.forkedFrom = src
  frame.frame.x += 40
  frame.frame.y += 40
  writeJSON(path.join(dstDir, 'frame.json'), frame)
  const canvas = readCanvas()
  if (!canvas.artifacts.find((a) => a.id === newId)) canvas.artifacts.push({ id: newId, path: `artifacts/${newId}` })
  writeCanvas(canvas)
  console.log(`✓ forked "${src}" → "${newId}"`)
}

function link(args) {
  const { pos, flags } = parseFlags(args)
  const [from, to] = pos
  if (!from || !to) die('link <from> <to> [--label "..."]')
  const canvas = readCanvas()
  canvas.edges = canvas.edges || []
  const id = `e-${from}-${to}`
  canvas.edges = canvas.edges.filter((e) => e.id !== id)
  canvas.edges.push({ id, from, to, toEnd: 'arrow', label: typeof flags.label === 'string' ? flags.label : '' })
  writeCanvas(canvas)
  console.log(`✓ linked ${from} → ${to}`)
}

function rm(args) {
  const { pos } = parseFlags(args)
  const id = pos[0]
  const dir = path.join(ARTIFACTS, id)
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
  const canvas = readCanvas()
  canvas.artifacts = (canvas.artifacts || []).filter((a) => a.id !== id)
  canvas.edges = (canvas.edges || []).filter((e) => e.from !== id && e.to !== id)
  canvas.groups = (canvas.groups || []).map((g) => ({ ...g, members: g.members.filter((m) => m !== id) }))
  writeCanvas(canvas)
  console.log(`✓ removed "${id}"`)
}

function list() {
  const canvas = readCanvas()
  if (!canvas.artifacts?.length) return console.log('(no artifacts yet — run: canvas scaffold <id>)')
  for (const a of canvas.artifacts) {
    const f = readFrame(a.id)
    console.log(`  ${a.id.padEnd(22)} ${f ? `${f.kind.padEnd(9)} (${f.frame.x},${f.frame.y}) ${f.frame.w}x${f.frame.h}` : '(no frame.json)'}`)
  }
}

// initialize a project's canvas. `--blank` wipes any existing/demo content so a
// fresh project starts clean.
function init(args) {
  const { flags } = parseFlags(args)
  fs.mkdirSync(ARTIFACTS, { recursive: true })
  const empty = { schema: 'infinite-canvas/1', version: 1, artifacts: [], groups: [], edges: [] }
  if (flags.blank) {
    for (const d of fs.readdirSync(ARTIFACTS)) fs.rmSync(path.join(ARTIFACTS, d), { recursive: true, force: true })
    writeCanvas(empty)
    console.log('✓ initialized a blank canvas (removed any demo/existing content)')
  } else if (!fs.existsSync(CANVAS)) {
    writeCanvas(empty)
    console.log('✓ initialized canvas.json')
  } else {
    console.log('canvas.json already exists — use `canvas init --blank` to reset to empty')
  }
}

// ---- dispatch --------------------------------------------------------------
const [cmd, ...rest] = process.argv.slice(2)
const cmds = { init, scaffold, place, fork, link, rm, list }
if (!cmd || !cmds[cmd]) {
  console.log('usage: canvas <init|scaffold|place|fork|link|rm|list> ...')
  process.exit(cmd ? 1 : 0)
}
cmds[cmd](rest)
