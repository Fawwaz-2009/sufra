import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder"
import { publicApi } from "../contract/public-api.ts"
import { Setup } from "../domain/setup.ts"

/**
 * Setup — the PUBLIC bootstrap controller (on `publicApi`, no Authentication). `show` reports whether
 * Setup is needed; `create` makes the first Host and returns a raw `HttpServerResponse` carrying the
 * session cookie. Thin → the Setup aggregate.
 */
export const SetupControllerLive = HttpApiBuilder.group(publicApi, "setup", (handlers) =>
  handlers.handle("show", () => Setup.status()).handle("create", ({ payload }) => Setup.create(payload))
)
