import * as Schema from "effect/Schema"
import * as Model from "effect/unstable/schema/Model"

/**
 * Branded id for the app-owned person. It IS the Better Auth identity id (a SHARED primary key,
 * copied in at sign-up), so it is the single anchor every app resource references as `userId` —
 * there is no separate surrogate to drift.
 */
export const UserId = Schema.String.pipe(Schema.brand("UserId"))
export type UserId = typeof UserId.Type

/**
 * The app-owned person — the aggregate root the product calls a "Member" (Host or Member by
 * `role` on the identity). Deliberately THIN: the credential (username/role) lives on `identities`;
 * the plan inputs are the append-only `profile_snapshots` collection (a later slice). `id` is
 * shared with the identity (set by the sign-up hook), never app-minted, never a client write — so
 * `FieldExcept(["jsonCreate","jsonUpdate"])`. Table: `users`.
 */
export class User extends Model.Class<User>("User")({
  id: Model.FieldExcept(["jsonCreate", "jsonUpdate"])(UserId),
  createdAt: Model.DateTimeInsert,
  updatedAt: Model.DateTimeUpdate
}) {}
