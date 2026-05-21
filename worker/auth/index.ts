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
    // `trustedOrigins` defaults to `[baseURL]`, which would reject sign-in
    // POSTs from any origin other than BETTER_AUTH_URL — breaking mobile
    // dogfooding where the phone hits `http://<LAN-IP>:5173` while the desk
    // browser hits `http://localhost:5173`. We trust whatever origin the
    // worker received the request on. In production the worker is only
    // reachable via the deployed domain, so this is functionally equivalent
    // to `trustedOrigins: [BETTER_AUTH_URL]` there.
    trustedOrigins: (request) =>
      request ? [new URL(request.url).origin] : [],
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
