import { betterAuth } from "better-auth"
import { admin, username } from "better-auth/plugins"
import { D1Dialect } from "kysely-d1"
import * as Context from "effect/Context"
import { ac, host, member } from "./permissions.ts"
import type { Bindings } from "../env.ts"

/**
 * Better Auth is its own subsystem: it owns its tables (identities/session/account/verification)
 * and its own DB access via Kysely's D1 dialect — it never touched the app's persistence stack, so
 * the app's move off Drizzle changes nothing here. Built once per isolate (env.DB/env.KV are stable
 * across requests).
 *
 * No email is ever sent (host-deployed, Grafana-style: Setup creates the first Host, the Host
 * provisions Members by username — ADR 0010). Sign-in is username + password.
 */
export const makeAuth = (env: Bindings, provisionUser: (id: string) => Promise<void>) =>
  betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,

    // Better Auth's core "user" table is our IDENTITY (the credential). Rename it to `identities`
    // so the app domain owns a clean `users` table with no collision. The session/account FKs
    // follow the modelName; auth.cli.ts mirrors this so a regenerated migration matches.
    user: { modelName: "identities" },

    // Native D1 via Kysely's dialect. `type` is required and lowercase.
    database: { dialect: new D1Dialect({ database: env.DB }), type: "sqlite" },

    // Sessions (and rate-limit state) live in Cloudflare KV, not D1: D1's read-after-write can
    // return a stale/empty session immediately after login. KV's 60s minimum expirationTtl would
    // throw on Better Auth's smaller TTLs, so clamp to the floor.
    secondaryStorage: {
      get: (key) => env.KV.get(key),
      set: (key, value, ttl) =>
        ttl !== undefined
          ? env.KV.put(key, value, { expirationTtl: Math.max(ttl, 60) })
          : env.KV.put(key, value),
      delete: (key) => env.KV.delete(key)
    },

    // Username + password (no email). The non-routable <username>@sufra.local satisfies Better
    // Auth's required email column. The public email sign-up HTTP route is disabled — accounts are
    // created by Setup (first Host) and the Host's admin.createUser (Members), both of which use
    // the internal API.
    emailAndPassword: { enabled: true },
    disabledPaths: ["/sign-up/email"],

    plugins: [
      username(),
      admin({ ac, roles: { host, member }, defaultRole: "member", adminRoles: ["host"] })
    ],

    // identities.name is a required core column we don't display (default it to keep NOT NULL
    // happy; inert). The `after` hook provisions the app-owned `users` row for the new identity
    // (shared id), so every authenticated read can assume it exists — no lazy find-or-create.
    databaseHooks: {
      user: {
        create: {
          before: async (user) => ({ data: { ...user, name: user.name || user.email } }),
          after: async (user) => {
            await provisionUser(user.id)
          }
        }
      }
    },

    // Workers don't auto-infer origin. Trust the origin the request arrived on — supports LAN-IP
    // dogfooding (phone hits http://<ip>:5173 while desktop hits localhost); in production the
    // worker is only reachable via its deployed origin, so this equals [BETTER_AUTH_URL].
    trustedOrigins: (request) => (request ? [new URL(request.url).origin] : [])
  })

/** The concrete runtime Better Auth instance type. */
export type AuthInstance = ReturnType<typeof makeAuth>

/** The built instance, exposed as a service so the Authentication middleware reads the SAME
 *  instance the worker entry uses, without reconstructing it. */
export class Auth extends Context.Service<Auth, AuthInstance>()("app/Auth") {}
