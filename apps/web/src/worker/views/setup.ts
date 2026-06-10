import * as Schema from "effect/Schema"

/**
 * Whether the deploy still needs Setup — `true` when zero Hosts exist (CONTEXT "Setup"). The public gate
 * signal: the SPA routes to `/setup` while `needsSetup`, and suppresses it forever after the first Host.
 */
export const SetupStatusView = Schema.Struct({ needsSetup: Schema.Boolean })
export type SetupStatusView = typeof SetupStatusView.Type
export type SetupStatusViewEncoded = typeof SetupStatusView.Encoded

/**
 * The bare ack both Setup-create and Password-link-redeem return. Their meaningful payload is the session
 * `Set-Cookie` they carry (the caller is signed in as a side effect — read via query invalidation, not
 * this body), so the JSON is just `{ ok: true }`. Returned by a raw `HttpServerResponse` so the handler
 * can attach Better Auth's cookie; this schema is what the typed client decodes from that body.
 */
export const OkView = Schema.Struct({ ok: Schema.Boolean })
export type OkView = typeof OkView.Type
export type OkViewEncoded = typeof OkView.Encoded
