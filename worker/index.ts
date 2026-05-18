import { Hono } from "hono"

const app = new Hono<{ Bindings: Env }>()
  .get("/api/health", (c) =>
    c.json({ status: "ok", service: "sufra", time: new Date().toISOString() })
  )
  .all("*", (c) => c.env.ASSETS.fetch(c.req.raw))

export type AppType = typeof app

export default app
