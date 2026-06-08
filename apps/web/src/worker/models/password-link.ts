import * as Schema from "effect/Schema"
import * as Model from "effect/unstable/schema/Model"

/** Branded id for the `password_links` table — a UUID v7 generated on insert. */
export const PasswordLinkId = Schema.String.pipe(Schema.brand("PasswordLinkId"))
export type PasswordLinkId = typeof PasswordLinkId.Type

/** 24-hour TTL — a Password link the Member hasn't redeemed expires (CONTEXT "Password link"). */
export const PASSWORD_LINK_TTL_MS = 24 * 60 * 60 * 1000

/**
 * A Password link (CONTEXT "Password link"; ADR 0016) — a single-use, Host-issued token that lets a
 * provisioned Member set their password (no email, so the Host hands the link over out of band). Opaque
 * base64url token; 24h TTL; UNIQUE on `userId` so there is exactly one active link per Member —
 * regenerating replaces it in place (the repo's `upsert`). Deleted the moment the password is set.
 *
 * No FK (constraint-free, inline-join style); cascade-on-Member-delete is an explicit app-domain delete
 * (the `User.members.destroy` cascade), not a DB trigger. Every field but the wire-create set is
 * server-owned (there is no client-write variant — the Host POSTs nothing, possession of the token IS
 * the credential). Table: `password_links`.
 */
export class PasswordLink extends Model.Class<PasswordLink>("PasswordLink")({
  id: Model.UuidV7Insert(PasswordLinkId),
  userId: Model.FieldExcept(["jsonCreate", "jsonUpdate"])(Schema.String),
  token: Model.FieldExcept(["jsonCreate", "jsonUpdate"])(Schema.String),
  createdBy: Model.FieldExcept(["jsonCreate", "jsonUpdate"])(Schema.String),
  createdAt: Model.DateTimeInsert,
  expiresAt: Model.FieldExcept(["jsonCreate", "jsonUpdate"])(Schema.String)
}) {}
