import type { Plugin, ViteDevServer } from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { marked } from 'marked'

// ---------------------------------------------------------------------------
// The "canvas host": a single-origin dev server where the FILE TREE is the
// source of truth and the canvas is a projection over it.
//   GET  /api/canvas              -> merged manifest (canvas.json + every frame.json)
//   PUT  /api/canvas              -> write canvas-level state (viewport / groups / edges)
//   PUT  /api/artifact/:id/frame  -> write a tile's x/y/w/h back to its frame.json
//   GET  /api/watch               -> SSE stream; emits "change" when files change
//   GET  /_artifact/:id/*         -> serve that artifact's files (md rendered to HTML)
// ---------------------------------------------------------------------------

const ROOT = process.cwd()
const ARTIFACTS_DIR = path.join(ROOT, 'artifacts')
const CANVAS_FILE = path.join(ROOT, 'canvas.json')
const EMPTY_CANVAS = { schema: 'infinite-canvas/1', version: 1, artifacts: [], groups: [], edges: [] }
// stable per-project key so canvas-only state (sticky notes, camera) is isolated
// between projects that share localhost:5173
const PROJECT_KEY = 'ec-' + crypto.createHash('sha1').update(ROOT).digest('hex').slice(0, 12)

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.md': 'text/markdown; charset=utf-8',
  '.ico': 'image/x-icon',
}

function readJSON(file: string): any {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function readFrame(id: string): any | null {
  const f = path.join(ARTIFACTS_DIR, id, 'frame.json')
  return fs.existsSync(f) ? readJSON(f) : null
}

// A markdown note file is served as a styled, scrollable HTML document, so a
// "document" is just an html tile through the normal iframe path.
function renderNote(innerHtml: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet"/>
<style>
  html,body{height:100%}
  body{margin:0;padding:20px 22px;font-family:'Inter',system-ui,sans-serif;color:#3a3a40;line-height:1.5;background:#fff}
  h1{font-family:'Fraunces',Georgia,serif;font-size:22px;margin:0 0 10px;color:#1a1a1d}
  h2{font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#8a8a90;margin:18px 0 6px}
  blockquote{margin:0 0 10px;padding-left:12px;border-left:3px solid #d4d4d8;color:#52525a;font-style:italic}
  p,li{font-size:13px}
  ul{margin:6px 0;padding-left:18px}
  strong{color:#1a1a1d}
</style></head><body>${innerHtml}</body></html>`
}

function buildCanvas() {
  if (!fs.existsSync(CANVAS_FILE)) return { ...EMPTY_CANVAS, projectKey: PROJECT_KEY }
  const canvas = readJSON(CANVAS_FILE)
  const artifacts = (canvas.artifacts || [])
    .map((a: any) => {
      const frame = readFrame(a.id)
      return frame ? { ...a, ...frame } : null
    })
    .filter(Boolean)
  return { ...canvas, projectKey: PROJECT_KEY, artifacts }
}

export function artifactHost(): Plugin {
  return {
    name: 'exploration-canvas-host',
    configureServer(server: ViteDevServer) {
      fs.mkdirSync(ARTIFACTS_DIR, { recursive: true })

      // --- file watcher -> Server-Sent Events ------------------------------
      const sseClients = new Set<import('node:http').ServerResponse>()
      let notifyTimer: NodeJS.Timeout | null = null
      const notify = () => {
        if (notifyTimer) clearTimeout(notifyTimer)
        notifyTimer = setTimeout(() => {
          for (const res of sseClients) res.write('data: change\n\n')
        }, 120)
      }
      try {
        fs.watch(ARTIFACTS_DIR, { recursive: true }, () => notify())
      } catch {}
      try {
        fs.watch(ROOT, (_e, fname) => {
          if (fname === 'canvas.json') notify()
        })
      } catch {}

      server.middlewares.use((req, res, next) => {
        const url = (req.url || '').split('?')[0]

        // --- manifest -------------------------------------------------------
        if (url === '/api/canvas' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(buildCanvas()))
          return
        }

        // --- write canvas-level state (viewport / groups / edges / grid) ----
        if (url === '/api/canvas' && req.method === 'PUT') {
          let body = ''
          req.on('data', (c) => (body += c))
          req.on('end', () => {
            try {
              const patch = JSON.parse(body || '{}')
              const canvas = fs.existsSync(CANVAS_FILE) ? readJSON(CANVAS_FILE) : { ...EMPTY_CANVAS }
              for (const k of ['viewport', 'groups', 'edges', 'grid']) {
                if (k in patch) canvas[k] = patch[k]
              }
              fs.writeFileSync(CANVAS_FILE, JSON.stringify(canvas, null, 2) + '\n')
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: true }))
            } catch (e: any) {
              res.statusCode = 400
              res.end(JSON.stringify({ error: String(e) }))
            }
          })
          return
        }

        // --- persist a tile's frame back to its frame.json ------------------
        const put = url.match(/^\/api\/artifact\/([^/]+)\/frame$/)
        if (put && req.method === 'PUT') {
          const id = put[1]
          let body = ''
          req.on('data', (c) => (body += c))
          req.on('end', () => {
            try {
              const patch = JSON.parse(body || '{}')
              const file = path.join(ARTIFACTS_DIR, id, 'frame.json')
              const frame = readJSON(file)
              frame.frame = { ...frame.frame, ...patch }
              fs.writeFileSync(file, JSON.stringify(frame, null, 2) + '\n')
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: true, frame: frame.frame }))
            } catch (e: any) {
              res.statusCode = 400
              res.end(JSON.stringify({ error: String(e) }))
            }
          })
          return
        }

        // --- live file watch (SSE) ------------------------------------------
        if (url === '/api/watch' && req.method === 'GET') {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          })
          res.write('retry: 1000\n\n')
          sseClients.add(res)
          req.on('close', () => sseClients.delete(res))
          return
        }

        // --- serve artifact files -------------------------------------------
        if (url.startsWith('/_artifact/')) {
          const rel = decodeURIComponent(url.slice('/_artifact/'.length))
          const slash = rel.indexOf('/')
          const id = slash === -1 ? rel : rel.slice(0, slash)
          let sub = slash === -1 ? '' : rel.slice(slash + 1)
          const dir = path.join(ARTIFACTS_DIR, id)
          if (!sub) sub = readFrame(id)?.entry || 'index.html'
          const filePath = path.join(dir, sub)
          if (!filePath.startsWith(dir + path.sep)) {
            res.statusCode = 403
            res.end('forbidden')
            return
          }
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const ext = path.extname(filePath).toLowerCase()
            res.removeHeader('X-Frame-Options') // tiles are embedded in same-origin iframes
            res.setHeader('Cache-Control', 'no-store') // always serve fresh artifact content
            if (ext === '.md') {
              const md = fs.readFileSync(filePath, 'utf8')
              res.setHeader('Content-Type', 'text/html; charset=utf-8')
              res.end(renderNote(marked.parse(md) as string))
              return
            }
            res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream')
            fs.createReadStream(filePath).pipe(res)
            return
          }
          res.statusCode = 404
          res.end('not found')
          return
        }

        next()
      })
    },
  }
}
