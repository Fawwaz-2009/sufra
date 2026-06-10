import * as Schema from "effect/Schema"
import { ProfileSnapshotView } from "./profile-snapshot.ts"

/**
 * The current account view (`GET /me`) — the per-session singleton. Carries the identity (id /
 * username / role — no email in Sufra) plus the Member's full Profile snapshot timeline (newest first)
 * and the derived `isOnboarded` flag.
 *
 * Why the whole timeline, not just "the current snapshot + derived numbers": Day segmentation is
 * client-side by the Member's TZ (CONTEXT "Day"; ADR 0002), so the server can't know which snapshot is
 * "today" for them. The SPA resolves the active snapshot for any selected day with `snapshotFor` and
 * derives Target / macros with `deriveProfile` (both browser-safe, `views/derive.ts`) — the same
 * derive-at-read formula the worker uses (ADR 0003). `isOnboarded` is the canonical gate signal
 * ("has ≥1 snapshot" — ADR 0001/0010); the client must not infer it from `profiles.length` lest a
 * future shape change diverge. Plain JSON, so `.Type === .Encoded`.
 */
export const MeView = Schema.Struct({
  id: Schema.String,
  username: Schema.String,
  role: Schema.String,
  isOnboarded: Schema.Boolean,
  profiles: Schema.Array(ProfileSnapshotView)
})
export type MeView = typeof MeView.Type
export type MeViewEncoded = typeof MeView.Encoded
