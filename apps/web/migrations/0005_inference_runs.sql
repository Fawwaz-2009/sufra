-- Inference runs — the DURABLE money ledger: one row per BILLED estimator call.
--
-- DECOUPLED from meals/estimates/users on purpose: the bill is ground truth, so deleting a meal or
-- removing a Member must NOT erase the record of money spent (the Host paid OpenRouter regardless). No FK
-- constraints; `userId` + `estimateId` are soft text columns (nullable). The rich per-attempt facts
-- (status, errorCode, tokens, latency) live on `estimates` (which dies with the meal); this ledger keeps
-- only what the bill needs (ADR 0017).
CREATE TABLE inference_runs (
  "id"               text not null primary key,
  "userId"           text,                  -- soft FK, NO constraint; survives Member deletion
  "estimateId"       text,                  -- soft trace ref, NO constraint; survives Estimate deletion
  "modelId"          text not null,
  "kind"             text not null,         -- 'estimate' | 'refinement'
  "costUsd"          real not null,
  "createdAt"        text not null
);
-- The Admin cost view sums this table per UTC range.
CREATE INDEX "inference_runs_created_idx" ON inference_runs ("createdAt");
