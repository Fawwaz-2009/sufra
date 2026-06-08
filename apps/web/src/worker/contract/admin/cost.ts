import * as Schema from "effect/Schema"
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup"
import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint"
import { CostView } from "../../views/cost.ts"
import { HostOnly } from "../middleware/host-only.ts"

/** The cost-rollup range — `[from, to)` UTC ISO instants (the Host's local month, mapped to UTC client-
 *  side, same shape as the meals/weights range queries). */
const CostQuery = Schema.Struct({ from: Schema.String, to: Schema.String })

/**
 * Admin cost — the inference-spend rollup (ADR 0013: host-scoped + instance-wide). `show` (`GET
 * /admin/cost?from&to`) sums the decoupled `inference_runs` audit over the range plus the account count
 * (the bill is ground truth — it survives meal/Member deletion). A SINGLETON report (no id) → `show`, not
 * `index`. Behind `HostOnly`.
 */
export const CostGroup = HttpApiGroup.make("cost")
  .add(HttpApiEndpoint.get("show", "/admin/cost", { query: CostQuery, success: CostView }))
  .middleware(HostOnly)
