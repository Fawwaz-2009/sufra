import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder"
import { api } from "../../contract/api.ts"
import { Cost } from "../../domain/cost.ts"

/** Admin cost — the inference-spend rollup over a range, thin → the Cost read-model (host-only). */
export const CostControllerLive = HttpApiBuilder.group(api, "cost", (handlers) =>
  handlers.handle("show", ({ query }) => Cost.show(query))
)
