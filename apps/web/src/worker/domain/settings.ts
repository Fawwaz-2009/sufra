import * as Effect from "effect/Effect"
import * as Clock from "effect/Clock"
import * as Option from "effect/Option"
import * as HttpApiError from "effect/unstable/httpapi/HttpApiError"
import { AppSettingsRepo } from "../db/app-settings.ts"
import { run } from "../db/sql.ts"
import { DEFAULT_VISION_MODEL_ID } from "../views/setting.ts"
import { toSettingsView } from "../views/setting.ts"
import type { UpdateSettings } from "../contract/settings.ts"

const nowIso = Effect.map(Clock.currentTimeMillis, (ms) => new Date(ms).toISOString())

/**
 * Settings — the instance config singleton aggregate (host-only; the `HostOnly` gate sits in front).
 *
 *  - show          — `GET /settings`: the current vision model + family name. 404 if absent (shouldn't
 *    happen post-Setup, which seeds the row).
 *  - update        — `PATCH /settings`: partial edit (an unknown model id was already rejected at the
 *    contract boundary), returns the fresh view.
 *  - visionModelId — the model the Meal estimator should use; the Slice 2 deferral closes here. Defaulted
 *    DEFENSIVELY so the estimator still runs (on the default) if the settings row is somehow missing,
 *    rather than 500ing a Member's meal capture.
 */
const show = Effect.fn("Settings.show")(function* () {
  const settings = yield* AppSettingsRepo
  const row = yield* run(settings.find())
  if (Option.isNone(row)) return yield* new HttpApiError.NotFound()
  return toSettingsView(row.value)
})

const update = Effect.fn("Settings.update")(function* (input: typeof UpdateSettings.Type) {
  const settings = yield* AppSettingsRepo
  const now = yield* nowIso
  yield* run(
    settings.updateWhere(
      { id: 1 },
      { visionModelId: input.visionModelId, familyName: input.familyName, updatedAt: now }
    )
  )
  const row = yield* run(settings.find())
  if (Option.isNone(row)) return yield* new HttpApiError.NotFound()
  return toSettingsView(row.value)
})

const visionModelId = Effect.fn("Settings.visionModelId")(function* () {
  const settings = yield* AppSettingsRepo
  const row = yield* run(settings.find())
  return Option.isNone(row) ? DEFAULT_VISION_MODEL_ID : row.value.visionModelId
})

export const Settings = { show, update, visionModelId } as const
