import { betterAuth } from "better-auth"
import { admin, username } from "better-auth/plugins"
import { expo } from "@better-auth/expo"
import { D1Dialect } from "kysely-d1"
import * as Context from "effect/Context"
import * as ManagedRuntime from "effect/ManagedRuntime"
import * as Layer from "effect/Layer"
import { ac, host, member } from "./permissions.ts"
import { SqlLayer } from "../db/sql.ts"
import { UsersRepoLayer } from "../db/users.ts"
import { User } from "../domain/user.ts"
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
    // created by Setup (first Host) and member provisioning (signUpEmail with a placeholder), both via
    // the internal API. `minPasswordLength: 6` honors the wizard/set-password UI ("6+ characters") —
    // Better Auth's default is 8, which would reject those passwords at signUp/updatePassword.
    emailAndPassword: { enabled: true, minPasswordLength: 6 },
    disabledPaths: ["/sign-up/email"],

    plugins: [
      username(),
      admin({ ac, roles: { host, member }, defaultRole: "member", adminRoles: ["host"] }),
      // The native (Expo) client. Adds NO tables — only the cookie-replay session transport (Set-Cookie
      // captured into SecureStore, replayed as a Cookie header). NOT bearer; the `auth.api.getSession`
      // bridge the Authentication middleware uses is unchanged. No auth.cli.ts mirror — expo() touches
      // no schema.
      expo()
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
    //
    // The native app is different: its requests carry the app's "sufra://" scheme as their Origin (not
    // a Worker URL), so the scheme must be trusted explicitly or Better Auth's CSRF check 403s every
    // device sign-in. The app ships as a dev build (not Expo Go — @expo/ui has native code), so
    // "sufra://" is the origin in dev AND production alike; no exp:// needed.
    trustedOrigins: (request) => [...(request ? [new URL(request.url).origin] : []), "sufra://"]
  })

/**
 * A Better Auth instance built FRESH for one request (its own provisioning runtime + adapter). Better Auth
 * resolves its `$context` (the Kysely-D1 adapter) lazily on first use and binds that D1 I/O to the request
 * that triggers it; a module-cached instance reused across requests deadlocks on Cloudflare (the `$context`
 * promise never resolves — the symptom was the app hanging on skeleton loaders). Building per request keeps
 * each D1 connection inside one request's I/O lifetime. The provisioning runtime is short-lived; the
 * `user.create.after` hook only fires on sign-up.
 */
export const makeRequestAuth = (env: Bindings): AuthInstance => {
  const provisioning = ManagedRuntime.make(UsersRepoLayer.pipe(Layer.provide(SqlLayer(env.DB))))
  const provisionUser = (id: string): Promise<void> => provisioning.runPromise(User.provision({ id }))
  return makeAuth(env, provisionUser)
}

/** The concrete runtime Better Auth instance type. */
export type AuthInstance = ReturnType<typeof makeAuth>

/** The Better Auth instance exposed as an Effect service — provided per request (`Layer.sync` over
 *  `makeRequestAuth` in runtime.ts) so the admin/setup/password-link handlers `yield* Auth` get a fresh
 *  instance whose D1 I/O is scoped to their request (a cached instance deadlocks across requests). */
export class Auth extends Context.Service<Auth, AuthInstance>()("app/Auth") {}
