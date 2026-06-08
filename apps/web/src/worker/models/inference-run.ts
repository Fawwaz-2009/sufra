import * as Schema from "effect/Schema"
import * as Model from "effect/unstable/schema/Model"

/** Branded id for the `inference_runs` audit table. */
export const InferenceRunId = Schema.String.pipe(Schema.brand("InferenceRunId"))
export type InferenceRunId = typeof InferenceRunId.Type

/**
 * An inference run — one row per estimator invocation, the audit log of money spent (CLAUDE.md
 * "inference_run audit log is decoupled"). DELIBERATELY decoupled: `userId` is a soft, nullable FK
 * with NO constraint, so the cost survives meal/Member deletion. A failed run that still billed tokens
 * is recorded too. This model is write-mostly in Slice 2; the Admin cost view reads it in Slice 4.
 */
export class InferenceRun extends Model.Class<InferenceRun>("InferenceRun")({
  id: Model.UuidV7Insert(InferenceRunId),
  userId: Model.FieldOption(Schema.String),
  modelId: Schema.String,
  kind: Schema.Literals(["estimate", "refinement"]),
  status: Schema.Literals(["ok", "failed"]),
  errorCode: Model.FieldOption(Schema.String),
  promptTokens: Schema.Int,
  completionTokens: Schema.Int,
  costUsd: Schema.Number,
  latencyMs: Schema.Int,
  createdAt: Model.DateTimeInsert
}) {}
