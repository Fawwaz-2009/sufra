import * as Layer from "effect/Layer"
import * as FileSystem from "effect/FileSystem"
import * as Path from "effect/Path"
import * as HttpRouter from "effect/unstable/http/HttpRouter"
import * as HttpPlatform from "effect/unstable/http/HttpPlatform"
import * as Etag from "effect/unstable/http/Etag"
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder"
import { api } from "./contract/api.ts"
import { publicApi } from "./contract/public-api.ts"
import { SqlLayer } from "./db/sql.ts"
import { Auth, makeRequestAuth } from "./auth/instance.ts"
import { AuthenticationLive } from "./middleware/authentication.ts"
import { MealScopedLive } from "./middleware/meal-scoped.ts"
import { HostOnlyLive } from "./middleware/host-only.ts"
import { UsersRepoLayer } from "./db/users.ts"
import { ProfileSnapshotsRepoLayer } from "./db/profile-snapshots.ts"
import { WeightsRepoLayer } from "./db/weights.ts"
import { MealsRepoLayer } from "./db/meals.ts"
import { AttachmentsRepoLayer } from "./db/attachments.ts"
import { InferenceRunsRepoLayer } from "./db/inference-runs.ts"
import { EstimatesRepoLayer } from "./db/estimates.ts"
import { AppSettingsRepoLayer } from "./db/app-settings.ts"
import { PasswordLinksRepoLayer } from "./db/password-links.ts"
import { BlobsLayer } from "./blobs/layers.ts"
import { VisionLayer } from "./domain/meal/estimatable/service.ts"
import { MeControllerLive } from "./controllers/me.ts"
import { ProfileSnapshotsControllerLive } from "./controllers/profile-snapshots.ts"
import { WeightsControllerLive } from "./controllers/weights.ts"
import { CalorieHistoryControllerLive } from "./controllers/calorie-history.ts"
import { MealsControllerLive } from "./controllers/meals.ts"
import { OverrideControllerLive } from "./controllers/meals/override.ts"
import { EstimatesControllerLive } from "./controllers/meals/estimates.ts"
import { SavedControllerLive } from "./controllers/meals/saved.ts"
import { ClonesControllerLive } from "./controllers/meals/clones.ts"
import { PhotoControllerLive } from "./controllers/meals/photo.ts"
import { MembersControllerLive } from "./controllers/admin/members.ts"
import { MemberPasswordLinkControllerLive } from "./controllers/admin/members/password-link.ts"
import { CostControllerLive } from "./controllers/admin/cost.ts"
import { SettingsControllerLive } from "./controllers/settings.ts"
import { SetupControllerLive } from "./controllers/setup.ts"
import { PasswordLinksControllerLive } from "./controllers/password-links.ts"
import type { Bindings } from "./env.ts"

/**
 * Platform layer the HttpApi builder needs. Workers have no filesystem, so provide a no-op FileSystem;
 * HttpPlatform depends on it. `provideMerge` keeps FileSystem visible alongside HttpPlatform/Path/Etag.
 */
const PlatformLayer = Layer.mergeAll(HttpPlatform.layer, Path.layer, Etag.layer).pipe(
  Layer.provideMerge(FileSystem.layerNoop({}))
)

/**
 * Assemble BOTH Effect HttpApis into Cloudflare-Worker fetch handlers. Called ONCE per isolate (bindings
 * are stable). One `SqlClient` for the isolate; the repos share it. The repos, `Blobs`, and `Vision` are
 * env-static singletons merged into a single request data layer that BOTH apis discharge via
 * `provideRequest`. `Auth` rides the same data layer but is built FRESH per request (see `authValue`).
 *
 * Two web handlers come back: `handler` (the authed `api` — Authentication api-wide, HostOnly on the
 * admin/settings groups) and `publicHandler` (the unauth `publicApi` — Setup + Password-link redemption,
 * the bootstrap surface that cannot sit behind a session). `handler.ts` dispatches the known public path
 * prefixes to `publicHandler`, everything else `/api/*` to `handler`.
 */
export const assembleHandler = (env: Bindings) => {
  const sql = SqlLayer(env.DB)
  const usersRepo = UsersRepoLayer.pipe(Layer.provide(sql))
  const profileSnapshotsRepo = ProfileSnapshotsRepoLayer.pipe(Layer.provide(sql))
  const weightsRepo = WeightsRepoLayer.pipe(Layer.provide(sql))
  const mealsRepo = MealsRepoLayer.pipe(Layer.provide(sql))
  const attachmentsRepo = AttachmentsRepoLayer.pipe(Layer.provide(sql))
  const inferenceRunsRepo = InferenceRunsRepoLayer.pipe(Layer.provide(sql))
  const estimatesRepo = EstimatesRepoLayer.pipe(Layer.provide(sql))
  const appSettingsRepo = AppSettingsRepoLayer.pipe(Layer.provide(sql))
  const passwordLinksRepo = PasswordLinksRepoLayer.pipe(Layer.provide(sql))
  const blobs = BlobsLayer(env)
  const vision = VisionLayer(env)
  // Better Auth is built FRESH per request — NOT an isolate singleton. Better Auth resolves its `$context`
  // (the Kysely-D1 adapter) lazily on first use and binds that D1 I/O to the request that triggered it; a
  // cached instance reused across requests deadlocks on Cloudflare (the `$context` promise never resolves —
  // the symptom was the app hanging on skeleton loaders). `Layer.sync` here is discharged by
  // `provideRequest` once per request, so every request-time `yield* Auth` (the admin/setup/password-link
  // handlers' `signUpEmail`/`internalAdapter`) gets an instance whose D1 connection lives and dies within
  // that one request. (The Authentication middleware builds its own per request via `makeRequestAuth`,
  // because `HttpApiMiddleware` forbids a residual `Auth` requirement in its context.)
  const authValue = Layer.sync(Auth, () => makeRequestAuth(env))

  // Per-request services, discharged via provideRequest (the repos/blobs/vision are stable singletons, but
  // the domain resolves them per-request, so they ride here together). `Auth` rides here too so it is built
  // fresh per request (see above).
  const dataLayer = Layer.mergeAll(
    usersRepo,
    profileSnapshotsRepo,
    weightsRepo,
    mealsRepo,
    attachmentsRepo,
    inferenceRunsRepo,
    estimatesRepo,
    appSettingsRepo,
    passwordLinksRepo,
    blobs,
    vision,
    authValue,
    sql
  )

  const appLayer = HttpApiBuilder.layer(api).pipe(
    Layer.provide(MeControllerLive),
    Layer.provide(ProfileSnapshotsControllerLive),
    Layer.provide(WeightsControllerLive),
    Layer.provide(CalorieHistoryControllerLive),
    Layer.provide(MealsControllerLive),
    Layer.provide(OverrideControllerLive),
    Layer.provide(EstimatesControllerLive),
    Layer.provide(SavedControllerLive),
    Layer.provide(ClonesControllerLive),
    Layer.provide(PhotoControllerLive),
    Layer.provide(MembersControllerLive),
    Layer.provide(MemberPasswordLinkControllerLive),
    Layer.provide(CostControllerLive),
    Layer.provide(SettingsControllerLive),
    Layer.provide(AuthenticationLive(env)), // middleware impl; builds Better Auth per request from env
    Layer.provide(MealScopedLive.pipe(Layer.provide(mealsRepo))), // loads CurrentMeal through the user
    Layer.provide(HostOnlyLive), // role gate for the admin/settings groups (404, not 403 — ADR 0013)
    Layer.provide(PlatformLayer),
    HttpRouter.provideRequest(dataLayer)
  )

  // The PUBLIC api — Setup + Password-link redemption, NO Authentication. Same repos + Auth instance;
  // dispatched by path prefix in handler.ts. A SEPARATE router (its own toWebHandler), so the two apis
  // never collide on the shared `/api` prefix.
  const publicAppLayer = HttpApiBuilder.layer(publicApi).pipe(
    Layer.provide(SetupControllerLive),
    Layer.provide(PasswordLinksControllerLive),
    Layer.provide(PlatformLayer),
    HttpRouter.provideRequest(dataLayer)
  )

  const handler = HttpRouter.toWebHandler(appLayer, { disableLogger: true }).handler
  const publicHandler = HttpRouter.toWebHandler(publicAppLayer, { disableLogger: true }).handler
  return { handler, publicHandler }
}
