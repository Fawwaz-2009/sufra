-- Inference runs — an append-only audit log of every estimateMeal() invocation.
--
-- DECOUPLED from meals and users on purpose: the bill is ground truth, so deleting a meal or removing a
-- Member must NOT erase the record of money spent. No FK constraints; `userId` is a soft text column
-- (nullable). A failed run that still billed tokens (the model produced output that didn't match the
-- schema) is recorded too, so monthly cost reflects reality.
CREATE TABLE inference_runs (
  "id"               text not null primary key,
  "userId"           text,                  -- soft FK, NO constraint; survives Member deletion
  "modelId"          text not null,
  "kind"             text not null,         -- 'estimate' | 'refinement'
  "status"           text not null,         -- 'ok' | 'failed'
  "errorCode"        text,                  -- the failure code when status = 'failed'
  "promptTokens"     integer not null,
  "completionTokens" integer not null,
  "costUsd"          real not null,
  "latencyMs"        integer not null,
  "createdAt"        text not null
);
-- The Admin cost view sums this table per UTC range.
CREATE INDEX "inference_runs_created_idx" ON inference_runs ("createdAt");
