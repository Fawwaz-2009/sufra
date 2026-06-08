import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { InferenceRun } from "../models/inference-run.ts"
import { makeTable } from "./table.ts"

/**
 * The inference-runs repository — write-only in Slice 2 (`create`, used by the Meal aggregate to record
 * cost around every estimator call, success or failure). The Admin cost rollup read lands in Slice 4.
 */
const make = Effect.gen(function* () {
  const { create } = yield* makeTable(InferenceRun, "inference_runs")
  return { create } as const
})

export interface InferenceRunsRepo extends Effect.Success<typeof make> {}
export const InferenceRunsRepo = Context.Service<InferenceRunsRepo>("app/inference-runs/InferenceRunsRepo")
export const InferenceRunsRepoLayer = Layer.effect(InferenceRunsRepo, make)
