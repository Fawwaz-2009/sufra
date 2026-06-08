import * as Layer from "effect/Layer"
import * as FileSystem from "effect/FileSystem"
import * as Path from "effect/Path"
import * as HttpRouter from "effect/unstable/http/HttpRouter"
import * as HttpPlatform from "effect/unstable/http/HttpPlatform"
import * as Etag from "effect/unstable/http/Etag"
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder"
import { api } from "./contract/api.ts"
import { SqlLayer } from "./db/sql.ts"
import { Auth, type AuthInstance } from "./auth/instance.ts"
import { AuthenticationLive } from "./middleware/authentication.ts"
import { UsersRepoLayer } from "./db/users.ts"
import { MeControllerLive } from "./controllers/me.ts"
import type { Bindings } from "./env.ts"

/**
 * Platform layer the HttpApi builder needs. Workers have no filesystem, so provide a no-op
 * FileSystem; HttpPlatform depends on it. `provideMerge` keeps FileSystem visible alongside
 * HttpPlatform/Path/Etag.
 */
const PlatformLayer = Layer.mergeAll(HttpPlatform.layer, Path.layer, Etag.layer).pipe(
  Layer.provideMerge(FileSystem.layerNoop({}))
)

/**
 * Assemble the Effect HttpApi into a Cloudflare-Worker fetch handler. Called ONCE per isolate by
 * the worker (bindings are stable), so everything below is built a single time.
 * `HttpRouter.toWebHandler` provides `HttpRouter` + the per-request services (the request, its
 * scope); everything else is wired here, once.
 */
export const assembleHandler = (env: Bindings, auth: AuthInstance) => {
  // One SqlClient/D1Client for the isolate; repos share it (Effect memoizes by ref).
  const sql = SqlLayer(env.DB)
  const usersRepo = UsersRepoLayer.pipe(Layer.provide(sql))

  // Per-request services, discharged via provideRequest.
  const dataLayer = Layer.mergeAll(usersRepo, sql)

  const appLayer = HttpApiBuilder.layer(api).pipe(
    Layer.provide(MeControllerLive),
    Layer.provide(AuthenticationLive), // middleware impl; needs Auth
    Layer.provide(Layer.succeed(Auth, auth)), // the shared Better Auth instance (built once)
    Layer.provide(PlatformLayer),
    HttpRouter.provideRequest(dataLayer)
  )

  return HttpRouter.toWebHandler(appLayer, { disableLogger: true })
}
