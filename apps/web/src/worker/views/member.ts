import * as Schema from "effect/Schema"

/**
 * A Member as the Host sees them in the Admin list — the app id (the shared anchor), the `username` joined
 * live from the credential (`identities`, never mirrored onto `users` — ADR 0010), and when the account
 * was created. Plain JSON, so `.Type === .Encoded`. The read decodes straight into this (the join is in
 * the query); a freshly-provisioned member serializes through `toMemberView`.
 */
export const MemberView = Schema.Struct({
  id: Schema.String,
  username: Schema.String,
  createdAt: Schema.String
})
export type MemberView = typeof MemberView.Type
export type MemberViewEncoded = typeof MemberView.Encoded

/** Serialize a provisioned member → its view (the create path; reads decode straight into MemberView). */
export const toMemberView = (input: {
  readonly id: string
  readonly username: string
  readonly createdAt: string
}): MemberView => ({ id: input.id, username: input.username, createdAt: input.createdAt })
