import * as Schema from "effect/Schema"

/**
 * An account as the Host sees it in the Admin list — the FULL household (Hosts included, badged by
 * `role`), not just the Members: the app id (the shared anchor), the `username` and `role` joined live
 * from the credential (`identities`, never mirrored onto `users` — ADR 0010), and when the account was
 * created. The Host appears in their own list (role badge, no actions) but the ACTION gates stay
 * Member-scoped (`findMember`) — issuing a link against / deleting a host 404s (ADR 0013). Plain JSON,
 * so `.Type === .Encoded`. The read decodes straight into this (the join is in the query); a
 * freshly-provisioned member serializes through `toMemberView`.
 */
export const MemberView = Schema.Struct({
  id: Schema.String,
  username: Schema.String,
  role: Schema.Literals(["host", "member"]),
  createdAt: Schema.String
})
export type MemberView = typeof MemberView.Type
export type MemberViewEncoded = typeof MemberView.Encoded

/** Serialize a provisioned member → its view (the create path; reads decode straight into MemberView). */
export const toMemberView = (input: {
  readonly id: string
  readonly username: string
  readonly role: "host" | "member"
  readonly createdAt: string
}): MemberView => ({ id: input.id, username: input.username, role: input.role, createdAt: input.createdAt })
