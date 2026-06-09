import * as Schema from "effect/Schema"
import * as Model from "effect/unstable/schema/Model"

/** Branded id for the `inference_runs` ledger table. */
export const InferenceRunId = Schema.String.pipe(Schema.brand("InferenceRunId"))
export type InferenceRunId = typeof InferenceRunId.Type

/**
 * An inference run — the DURABLE money ledger (CLAUDE.md "inference_run audit log is decoupled"). One
 * row per BILLED estimator call. Deliberately decoupled: `userId` + `estimateId` are soft, nullable
 * refs with NO constraint, so the cost SURVIVES Meal/Estimate/Member deletion (the Host paid OpenRouter
 * regardless — the bill is ground truth). The rich per-attempt facts (status, errorCode, tokens,
 * latency) live on the `estimates` row, which dies with the meal; this ledger keeps only what the bill
 * needs (ADR 0017). The Admin cost view sums `costUsd` per UTC range.
 */
export class InferenceRun extends Model.Class<InferenceRun>("InferenceRun")({
  id: Model.UuidV7Insert(InferenceRunId),
  userId: Model.FieldOption(Schema.String),
  estimateId: Model.FieldOption(Schema.String),
  modelId: Schema.String,
  kind: Schema.Literals(["estimate", "refinement"]),
  costUsd: Schema.Number,
  createdAt: Model.DateTimeInsert
}) {}
