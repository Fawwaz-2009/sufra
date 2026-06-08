import * as ManagedRuntime from "effect/ManagedRuntime"
import * as Layer from "effect/Layer"
import { makeAuth, type AuthInstance } from "./auth/instance.ts"
import { assembleHandler } from "./runtime.ts"
import { SqlLayer } from "./db/sql.ts"
import { UsersRepoLayer } from "./db/users.ts"
import { User } from "./domain/user.ts"
import type { Bindings } from "./env.ts"

/**
 * The backend app, built ONCE per isolate. Exposed as `getApp`/`getAuth` so both consumers share
 * the single Better Auth instance: the worker fetch handler (serveBackend) AND the frontend's
 * session read (authClient over /api/auth/*). Bindings are stable across requests, so the Effect
 * app layer + Better Auth are constructed a single time.
 */
let app:
  | {
      readonly auth: AuthInstance
      readonly handler: ReturnType<typeof assembleHandler>["handler"]
    }
  | undefined

export const getApp = (env: Bindings) => {
  if (app === undefined) {
    // Better Auth's user.create.after hook fires OUTSIDE the Effect request, so run the
    // provisioning effect (insert the app-owned `users` row) through a tiny isolate-level runtime —
    // UsersRepo over the D1 SQL layer.
    const provisioning = ManagedRuntime.make(UsersRepoLayer.pipe(Layer.provide(SqlLayer(env.DB))))
    const provisionUser = (id: string): Promise<void> => provisioning.runPromise(User.provision({ id }))

    const auth = makeAuth(env, provisionUser)
    const { handler } = assembleHandler(env, auth)
    app = { auth, handler }
  }
  return app!
}

/** The shared Better Auth instance — used by the worker AND any session read. */
export const getAuth = (env: Bindings): AuthInstance => getApp(env).auth
