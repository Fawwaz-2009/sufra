import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { admin, username } from "better-auth/plugins"

import { createDb } from "../db"
import { ac, host, user } from "./isomorphic/permissions"

export type AuthEnv = {
  DB: D1Database
  BETTER_AUTH_SECRET: string
  BETTER_AUTH_URL?: string
}

export const createAuth = (env: AuthEnv) => {
  const db = createDb(env.DB)
  return betterAuth({
    database: drizzleAdapter(db, { provider: "sqlite" }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    emailAndPassword: { enabled: true },
    disabledPaths: ["/sign-up/email"],
    plugins: [
      username(),
      admin({
        ac,
        roles: { host, user },
        defaultRole: "user",
        adminRoles: ["host"],
      }),
    ],
  })
}

export type Auth = ReturnType<typeof createAuth>
