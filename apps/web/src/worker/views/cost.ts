import * as Schema from "effect/Schema"

/**
 * The inference-cost rollup over a UTC range (Admin) — total spend, the number of runs, the number of
 * accounts, and the per-account average (total ÷ accounts). Summed from the decoupled `inference_runs`
 * audit log (the bill is ground truth — it survives meal/Member deletion), so it reflects real money spent
 * even on failed-but-billed runs. Plain JSON.
 */
export const CostView = Schema.Struct({
  totalUsd: Schema.Number,
  runCount: Schema.Number,
  memberCount: Schema.Number,
  perMemberAvgUsd: Schema.Number
})
export type CostView = typeof CostView.Type
export type CostViewEncoded = typeof CostView.Encoded
