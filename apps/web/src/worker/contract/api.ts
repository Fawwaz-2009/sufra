import * as HttpApi from "effect/unstable/httpapi/HttpApi"
import { MeGroup } from "./me.ts"
import { ProfileSnapshotsGroup } from "./profile-snapshots.ts"
import { WeightsGroup } from "./weights.ts"
import { MealsGroup } from "./meals.ts"
import { OverrideGroup } from "./meals/override.ts"
import { RefinementGroup } from "./meals/refinement.ts"
import { SavedGroup } from "./meals/saved.ts"
import { ClonesGroup } from "./meals/clones.ts"
import { PhotoGroup } from "./meals/photo.ts"
import { MembersGroup } from "./admin/members.ts"
import { MemberPasswordLinkGroup } from "./admin/members/password-link.ts"
import { CostGroup } from "./admin/cost.ts"
import { SettingsGroup } from "./settings.ts"
import { Authentication } from "./middleware/authentication.ts"

/**
 * The public HTTP contract, mounted under `/api`, with the api-wide Authentication middleware
 * (every endpoint requires a session → `CurrentUser`). Better Auth's own routes live under
 * `/api/auth/*` and are handled directly by `auth.handler` in the worker entry — NOT part of this
 * Effect HttpApi. The meal sub-resources carry their own `MealScoped` guard (in each group's
 * contract). Profile-snapshots + weights are user-scoped (no resource middleware); the admin/settings
 * groups carry their own `HostOnly` gate (host-scoped + instance-wide — ADR 0013). The UNAUTH bootstrap
 * surface (setup + password-link redeem) is a SEPARATE `publicApi` (no Authentication) — see
 * `contract/public-api.ts`.
 */
export const api = HttpApi.make("api")
  .add(MeGroup)
  .add(ProfileSnapshotsGroup)
  .add(WeightsGroup)
  .add(MealsGroup)
  .add(OverrideGroup)
  .add(RefinementGroup)
  .add(SavedGroup)
  .add(ClonesGroup)
  .add(PhotoGroup)
  .add(MembersGroup)
  .add(MemberPasswordLinkGroup)
  .add(CostGroup)
  .add(SettingsGroup)
  .middleware(Authentication)
  .prefix("/api")
