import * as Schema from "effect/Schema"
import * as Model from "effect/unstable/schema/Model"
import { WeightKg } from "./profile-snapshot.ts"

/** Branded id for the `weights` table — a UUID v7 generated on insert. */
export const WeightId = Schema.String.pipe(Schema.brand("WeightId"))
export type WeightId = typeof WeightId.Type

/**
 * A Weight — one measurement record (CONTEXT "Weight"), renamed from the old `weight_log` per ADR 0011.
 * Logging a Weight is one atomic dual-append: this measurement row PLUS a `profile_snapshots` row
 * effective tomorrow (the plan input that drives Target derivation). The two live in the Member
 * aggregate's `weights.log` (ADR 0011). A Weight is user-CORRECTABLE: it can be deleted from the
 * Progress chart, and that delete never touches `profile_snapshots` — sealed plans don't move (ADR 0007).
 *
 * `loggedAt` is the measurement instant (what the chart plots + the range query filters); `createdAt`
 * is the audit stamp. Both are server-set, so neither is a client write. There is no `update` — a Weight
 * is immutable; a correction is delete + re-log.
 */
export class Weight extends Model.Class<Weight>("Weight")({
  id: Model.UuidV7Insert(WeightId),

  // FK to users(id) — NO db constraint (inline-join approach). Set from CurrentUser, never client-sent.
  userId: Model.FieldExcept(["jsonCreate", "jsonUpdate"])(Schema.String),

  weightKg: WeightKg,

  // The measurement instant (UTC ISO Z), server-resolved to "now" at log time. Out of the wire writes.
  loggedAt: Model.FieldExcept(["jsonCreate", "jsonUpdate"])(Schema.String),

  createdAt: Model.DateTimeInsert
}) {}
