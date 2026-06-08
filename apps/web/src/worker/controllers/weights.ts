import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder"
import { api } from "../contract/api.ts"
import { User } from "../domain/user.ts"

/** Weights — index / log / delete, each one thin line to the Member aggregate's weights concern. */
export const WeightsControllerLive = HttpApiBuilder.group(api, "weights", (handlers) =>
  handlers
    .handle("index", ({ query }) => User.weights.index(query))
    .handle("create", ({ payload }) => User.weights.log(payload))
    .handle("destroy", ({ params }) => User.weights.remove({ id: params.id }))
)
