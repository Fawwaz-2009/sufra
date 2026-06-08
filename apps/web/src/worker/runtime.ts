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
import { MealScopedLive } from "./middleware/meal-scoped.ts"
import { UsersRepoLayer } from "./db/users.ts"
import { ProfileSnapshotsRepoLayer } from "./db/profile-snapshots.ts"
import { WeightsRepoLayer } from "./db/weights.ts"
import { MealsRepoLayer } from "./db/meals.ts"
import { AttachmentsRepoLayer } from "./db/attachments.ts"
import { InferenceRunsRepoLayer } from "./db/inference-runs.ts"
import { BlobsLayer } from "./blobs/layers.ts"
import { EstimatorLayer } from "./estimator/layers.ts"
import { MeControllerLive } from "./controllers/me.ts"
import { ProfileSnapshotsControllerLive } from "./controllers/profile-snapshots.ts"
import { WeightsControllerLive } from "./controllers/weights.ts"
import { MealsControllerLive } from "./controllers/meals.ts"
import { OverrideControllerLive } from "./controllers/meals/override.ts"
import { RefinementControllerLive } from "./controllers/meals/refinement.ts"
import { SavedControllerLive } from "./controllers/meals/saved.ts"
import { ClonesControllerLive } from "./controllers/meals/clones.ts"
import { PhotoControllerLive } from "./controllers/meals/photo.ts"
import type { Bindings } from "./env.ts"

/**
 * Platform layer the HttpApi builder needs. Workers have no filesystem, so provide a no-op FileSystem;
 * HttpPlatform depends on it. `provideMerge` keeps FileSystem visible alongside HttpPlatform/Path/Etag.
 */
const PlatformLayer = Layer.mergeAll(HttpPlatform.layer, Path.layer, Etag.layer).pipe(
  Layer.provideMerge(FileSystem.layerNoop({}))
)

/**
 * Assemble the Effect HttpApi into a Cloudflare-Worker fetch handler. Called ONCE per isolate (bindings
 * are stable). One `SqlClient` for the isolate; repos share it. `Blobs` + `Estimator` are env-static
 * (the binding/key are stable), so they're built once and merged into the request data layer.
 */
export const assembleHandler = (env: Bindings, auth: AuthInstance) => {
  const sql = SqlLayer(env.DB)
  const usersRepo = UsersRepoLayer.pipe(Layer.provide(sql))
  const profileSnapshotsRepo = ProfileSnapshotsRepoLayer.pipe(Layer.provide(sql))
  const weightsRepo = WeightsRepoLayer.pipe(Layer.provide(sql))
  const mealsRepo = MealsRepoLayer.pipe(Layer.provide(sql))
  const attachmentsRepo = AttachmentsRepoLayer.pipe(Layer.provide(sql))
  const inferenceRunsRepo = InferenceRunsRepoLayer.pipe(Layer.provide(sql))
  const blobs = BlobsLayer(env)
  const estimator = EstimatorLayer(env)

  // Per-request services, discharged via provideRequest. (blobs/estimator are stable singletons, but the
  // domain resolves them per-request, so they ride here alongside the repos.)
  const dataLayer = Layer.mergeAll(
    usersRepo,
    profileSnapshotsRepo,
    weightsRepo,
    mealsRepo,
    attachmentsRepo,
    inferenceRunsRepo,
    blobs,
    estimator,
    sql
  )

  const appLayer = HttpApiBuilder.layer(api).pipe(
    Layer.provide(MeControllerLive),
    Layer.provide(ProfileSnapshotsControllerLive),
    Layer.provide(WeightsControllerLive),
    Layer.provide(MealsControllerLive),
    Layer.provide(OverrideControllerLive),
    Layer.provide(RefinementControllerLive),
    Layer.provide(SavedControllerLive),
    Layer.provide(ClonesControllerLive),
    Layer.provide(PhotoControllerLive),
    Layer.provide(AuthenticationLive), // middleware impl; needs Auth
    Layer.provide(MealScopedLive.pipe(Layer.provide(mealsRepo))), // loads CurrentMeal through the user
    Layer.provide(Layer.succeed(Auth, auth)), // the shared Better Auth instance (built once)
    Layer.provide(PlatformLayer),
    HttpRouter.provideRequest(dataLayer)
  )

  return HttpRouter.toWebHandler(appLayer, { disableLogger: true })
}
