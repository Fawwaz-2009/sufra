import * as Effect from "effect/Effect"
import { InferenceRunsRepo } from "../db/inference-runs.ts"
import { UsersRepo } from "../db/users.ts"
import { run } from "../db/sql.ts"
import type { CostView } from "../views/cost.ts"

/**
 * Cost — the inference-spend rollup (host-only, instance-wide; ADR 0013, the `HostOnly` gate in front). A
 * read-model (no writes → a plain read verb, not an aggregate-with-concerns): sum the decoupled
 * `inference_runs` audit over the range and divide by the MEMBER count (Host-excluding per CONTEXT, matching
 * the admin member list) for the per-Member average. The bill is ground truth — it survives meal/Member
 * deletion (the audit decoupling). `memberCount` is 0 before any Member is provisioned → the average is 0.
 */
const show = Effect.fn("Cost.show")(function* (range: { readonly from: string; readonly to: string }) {
  const runs = yield* InferenceRunsRepo
  const users = yield* UsersRepo
  const { totalUsd, runCount } = yield* run(runs.sumByRange(range))
  const memberCount = yield* run(users.countMembers())
  const perMemberAvgUsd = memberCount > 0 ? totalUsd / memberCount : 0
  return { totalUsd, runCount, memberCount, perMemberAvgUsd } satisfies CostView
})

export const Cost = { show } as const
