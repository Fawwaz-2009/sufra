import * as HttpApi from "effect/unstable/httpapi/HttpApi"
import { MeGroup } from "./me.ts"
import { Authentication } from "./middleware/authentication.ts"

/**
 * The public HTTP contract, mounted under `/api`, with the api-wide Authentication middleware
 * (every endpoint requires a session → `CurrentUser`). Better Auth's own routes live under
 * `/api/auth/*` and are handled directly by `auth.handler` in the worker entry — NOT part of this
 * Effect HttpApi. Groups for meals/profile-snapshots/weights/admin are added in later slices.
 */
export const api = HttpApi.make("api").add(MeGroup).middleware(Authentication).prefix("/api")
