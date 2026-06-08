import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder"
import { api } from "../../contract/api.ts"
import { Cost } from "../../projections/cost.ts"

/** Admin cost — the inference-spend rollup over a range, thin → the Cost projection (host-only). */
export const CostControllerLive = HttpApiBuilder.group(api, "cost", (handlers) =>
  handlers.handle("show", ({ query }) => Cost.show(query))
)
