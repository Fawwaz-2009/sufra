import { Hono } from "hono"

import { adminRouter } from "./routes/admin"
import { authRouter } from "./routes/auth"
import { calorieHistoryRouter } from "./routes/calorie-history"
import { healthRouter } from "./routes/health"
import { mealsRouter } from "./routes/meals"
import { profileRouter } from "./routes/profile"
import { setupRouter } from "./routes/setup"
import { weightsRouter } from "./routes/weights"
import type { AppEnvCtx } from "./types"

const app = new Hono<AppEnvCtx>()
  .route("/api", healthRouter)
  .route("/api/auth", authRouter)
  .route("/api", setupRouter)
  .route("/api/meals", mealsRouter)
  .route("/api/weights", weightsRouter)
  .route("/api/calorie-history", calorieHistoryRouter)
  .route("/api", profileRouter)
  .route("/api/admin", adminRouter)
  .all("*", (c) => c.env.ASSETS.fetch(c.req.raw))

export type AppType = typeof app

export default app
