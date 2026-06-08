import * as Effect from "effect/Effect"
import * as Clock from "effect/Clock"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import * as HttpApiError from "effect/unstable/httpapi/HttpApiError"
import { ProfileSnapshotsRepo } from "../../db/profile-snapshots.ts"
import { WeightsRepo } from "../../db/weights.ts"
import { atomically, run } from "../../db/sql.ts"
import { CurrentUser } from "../../contract/middleware/authentication.ts"
import { ProfileSnapshot, type WeightUnit } from "../../models/profile-snapshot.ts"
import { Weight } from "../../models/weight.ts"
import { toWeightView } from "../../views/weight.ts"
import { orNotFound } from "../../support/http.ts"

const nowIso = Effect.map(Clock.currentTimeMillis, (ms) => new Date(ms).toISOString())

/**
 * Weights — the Member's measurement records (CONTEXT "Weight"; ADR 0007, user-correctable).
 *
 *  - `index` — the Progress chart: a Member's weights in a logged-at range.
 *  - `log` — the ONE atomic dual-append (ADR 0011): a `weights` measurement row PLUS a
 *    `profile_snapshots` row effective tomorrow (the plan input that drives Target from tomorrow on;
 *    today stays sealed — ADR 0002). The snapshot inherits every field from the latest snapshot except
 *    the new weight; the upsert handles "logged twice the same day." Requires an existing profile (a
 *    Weight has no plan to attach to before onboarding → 404).
 *  - `remove` — delete one of the Member's own weights (the chart's tap-a-dot). NEVER touches
 *    `profile_snapshots` — sealed plans don't move (ADR 0007). Load-is-authorizing: absent/foreign → 404.
 */
export const index = Effect.fn("User.weights.index")(function* (query: {
  readonly from: string
  readonly to: string
}) {
  const { id: userId } = yield* CurrentUser
  const weights = yield* WeightsRepo
  const rows = yield* run(weights.inRange({ userId, from: query.from, to: query.to }))
  return rows.map(toWeightView)
})

export const log = Effect.fn("User.weights.log")(function* (input: {
  readonly weightKg: number
  readonly displayWeightUnit?: WeightUnit | undefined
  readonly effectiveFrom: string
}) {
  const { id: userId } = yield* CurrentUser
  const snapshots = yield* ProfileSnapshotsRepo
  const weights = yield* WeightsRepo

  const latest = yield* run(snapshots.latest({ userId }))
  if (Option.isNone(latest)) return yield* new HttpApiError.NotFound()
  const prev = latest.value

  const now = yield* nowIso
  const snapRow = Schema.encodeSync(ProfileSnapshot.insert)(
    ProfileSnapshot.insert.make({
      userId,
      effectiveFrom: input.effectiveFrom,
      sex: prev.sex,
      birthday: prev.birthday,
      heightCm: prev.heightCm,
      displayHeightUnit: prev.displayHeightUnit,
      weightKg: input.weightKg,
      displayWeightUnit: input.displayWeightUnit ?? prev.displayWeightUnit,
      activityLevel: prev.activityLevel,
      goalWeightKg: prev.goalWeightKg,
      weeklyRateKg: prev.weeklyRateKg
    })
  )
  const weightRow = Schema.encodeSync(Weight.insert)(
    Weight.insert.make({ userId, weightKg: input.weightKg, loggedAt: now })
  )
  yield* atomically([weights.insert(weightRow), snapshots.upsert(snapRow)])
  return toWeightView(Schema.decodeUnknownSync(Weight.select)(weightRow))
})

export const remove = Effect.fn("User.weights.remove")(function* (input: { readonly id: string }) {
  const { id: userId } = yield* CurrentUser
  const weights = yield* WeightsRepo
  yield* run(weights.find({ id: input.id, userId })).pipe(orNotFound)
  yield* run(weights.delete({ id: input.id, userId }))
})
