import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import { InferenceRun } from "../models/inference-run.ts"
import { makeTable } from "./table.ts"
import { type Command } from "./sql.ts"

const RollupRow = Schema.Struct({ totalUsd: Schema.Number, runCount: Schema.Int })

/**
 * The inference-runs repository — the decoupled cost audit (no FK; survives meal/Member deletion).
 *
 *  - `create`     — the Meal aggregate records cost around every estimator call, success or billed-failure.
 *  - `sumByRange` — the Admin cost rollup: total spend + run count over a `[from, to)` UTC range. COALESCE
 *    keeps an empty range a clean `0`, not NULL.
 */
const make = Effect.gen(function* () {
  const { sql, create } = yield* makeTable(InferenceRun, "inference_runs")

  const sumByRange = (range: {
    readonly from: string
    readonly to: string
  }): Command<{ readonly totalUsd: number; readonly runCount: number }> => ({
    statement: Effect.sync(() => sql`
      SELECT COALESCE(SUM(costUsd), 0) AS totalUsd, COUNT(*) AS runCount
      FROM inference_runs
      WHERE createdAt >= ${range.from} AND createdAt < ${range.to}
    `),
    decode: (rows) => Schema.decodeUnknownEffect(RollupRow)(rows[0]).pipe(Effect.orDie)
  })

  return { create, sumByRange } as const
})

export interface InferenceRunsRepo extends Effect.Success<typeof make> {}
export const InferenceRunsRepo = Context.Service<InferenceRunsRepo>("app/inference-runs/InferenceRunsRepo")
export const InferenceRunsRepoLayer = Layer.effect(InferenceRunsRepo, make)
