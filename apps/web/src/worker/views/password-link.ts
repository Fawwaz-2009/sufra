import * as Schema from "effect/Schema"

/**
 * What the Host gets back when issuing a Password link (the host-only `password-link` sub-resource create)
 * — the opaque `token` (the one thing the Host can't compute) plus its `expiresAt`. The Host builds
 * `/set-password/:token` and hands it over out of band. (A create returns only what the client can't
 * otherwise know — ADR 0016.)
 */
export const PasswordLinkIssuedView = Schema.Struct({
  token: Schema.String,
  expiresAt: Schema.String
})
export type PasswordLinkIssuedView = typeof PasswordLinkIssuedView.Type
export type PasswordLinkIssuedViewEncoded = typeof PasswordLinkIssuedView.Encoded

/**
 * What the public set-password page reads for a valid, unexpired token (the public `password-links` show)
 * — who the link is for and the family name, for the "Welcome to the {familyName} Sufra, {username}" copy.
 * Possession of the token IS the credential; an invalid/expired token is a uniform 404 (no existence leak).
 */
export const PasswordLinkShowView = Schema.Struct({
  username: Schema.String,
  familyName: Schema.String
})
export type PasswordLinkShowView = typeof PasswordLinkShowView.Type
export type PasswordLinkShowViewEncoded = typeof PasswordLinkShowView.Encoded
