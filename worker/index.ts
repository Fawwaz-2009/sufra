import { Hono } from "hono"

type Bindings = {
  ASSETS: Fetcher
}

const app = new Hono<{ Bindings: Bindings }>()
  .get("/api/health", (c) =>
    c.json({ status: "ok", service: "sufra", time: new Date().toISOString() })
  )
  .all("*", (c) => c.env.ASSETS.fetch(c.req.raw))

export type AppType = typeof app

export default app
