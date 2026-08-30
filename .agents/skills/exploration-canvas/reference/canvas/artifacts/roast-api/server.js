// Placeholder for the full-stack tier. In the real design the canvas host
// lazy-spawns this process on focus, allocates a port, and reverse-proxies it
// onto /_artifact/roast-api/ so it renders as a live tile. Not booted in the
// demo — that's the HMR-over-path-proxy spike (see docs/founding-design.md §8).
import http from 'node:http'

const ROASTS = [
  { name: 'Sunrise Yirgacheffe', origin: 'Ethiopia', notes: ['floral', 'bright', 'citrus'] },
  { name: 'Cellar Reserve', origin: 'Sumatra', notes: ['chocolatey', 'earthy'] },
  { name: 'Orchard Honey', origin: 'Costa Rica', notes: ['nutty', 'caramel'] },
]

const port = process.env.PORT || 0
http
  .createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ ok: true, roasts: ROASTS }))
  })
  .listen(port, () => console.log(`roast-api on :${port}`))
