import * as Schema from "effect/Schema"

/**
 * The current account's view — the schema-level "user" the product calls a Member. `id` (the
 * anchor) + the credential handle `username` + `role` (host|member). No email (none in Sufra); the
 * resolved profile/plan is composed by the Member aggregate in a later slice. Plain JSON, so
 * `.Type === .Encoded` (consumable by web AND native clients).
 */
export const UserView = Schema.Struct({
  id: Schema.String,
  username: Schema.String,
  role: Schema.String
})
export type UserView = typeof UserView.Type
export type UserViewEncoded = typeof UserView.Encoded
