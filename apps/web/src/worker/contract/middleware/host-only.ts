import * as HttpApiMiddleware from "effect/unstable/httpapi/HttpApiMiddleware"
import * as HttpApiError from "effect/unstable/httpapi/HttpApiError"
import { CurrentUser } from "./authentication.ts"

/**
 * HostOnly — the role gate for the host-facing admin surface. Role is just another SCOPING predicate
 * (ADR 0013): a non-host gets the SAME uniform 404 a non-owner gets, never a 403 — no existence leak, one
 * authorization shape across the whole app. It `requires: CurrentUser` (so it can read `role`) and
 * provides NOTHING — it only GATES, letting the wrapped endpoint through when `role === "host"`. Attached
 * to every admin/settings group (host-scoped + INSTANCE-WIDE: the Host acts across all Members, so the
 * scope is "is host," not "is owner"). The IMPLEMENTATION lives in `middleware/host-only.ts`.
 */
export class HostOnly extends HttpApiMiddleware.Service<HostOnly, { requires: CurrentUser }>()(
  "app/HostOnly",
  { error: HttpApiError.NotFound }
) {}
