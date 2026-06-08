import * as HttpApi from "effect/unstable/httpapi/HttpApi"
import { MeGroup } from "./me.ts"
import { MealsGroup } from "./meals.ts"
import { OverrideGroup } from "./meals/override.ts"
import { RefinementGroup } from "./meals/refinement.ts"
import { SavedGroup } from "./meals/saved.ts"
import { ClonesGroup } from "./meals/clones.ts"
import { PhotoGroup } from "./meals/photo.ts"
import { Authentication } from "./middleware/authentication.ts"

/**
 * The public HTTP contract, mounted under `/api`, with the api-wide Authentication middleware
 * (every endpoint requires a session → `CurrentUser`). Better Auth's own routes live under
 * `/api/auth/*` and are handled directly by `auth.handler` in the worker entry — NOT part of this
 * Effect HttpApi. The meal sub-resources carry their own `MealScoped` guard (in each group's
 * contract). Groups for profile-snapshots/weights/admin are added in later slices.
 */
export const api = HttpApi.make("api")
  .add(MeGroup)
  .add(MealsGroup)
  .add(OverrideGroup)
  .add(RefinementGroup)
  .add(SavedGroup)
  .add(ClonesGroup)
  .add(PhotoGroup)
  .middleware(Authentication)
  .prefix("/api")
