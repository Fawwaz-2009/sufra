import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { AppSetting } from "../models/app-setting.ts"
import { makeTable } from "./table.ts"
import { command, type Command } from "./sql.ts"

/**
 * The app-settings repository — the instance config SINGLETON (`id = 1`). `updateWhere` (from makeTable)
 * backs the partial Admin PATCH; the custom members are:
 *
 *  - `find`   — the singleton row (the estimator's vision model + the family name). `None` before Setup.
 *  - `upsert` — Setup seeds id=1; a re-run (e.g. a stale row from a dev DB whose Host was deleted)
 *    OVERWRITES it so the wizard's input wins (ON CONFLICT (id) DO UPDATE). The `id = 1` CHECK pins it.
 */
const make = Effect.gen(function* () {
  const { sql, updateWhere } = yield* makeTable(AppSetting, "app_settings")

  const find = (): Command<Option.Option<typeof AppSetting.select.Type>> => ({
    statement: Effect.sync(
      () => sql`SELECT id, visionModelId, familyName, updatedAt FROM app_settings WHERE id = 1`
    ),
    decode: (rows) =>
      rows.length === 0
        ? Effect.succeed(Option.none())
        : Schema.decodeUnknownEffect(AppSetting.select)(rows[0]).pipe(Effect.orDie, Effect.map(Option.some))
  })

  const upsert = (row: {
    readonly visionModelId: string
    readonly familyName: string
    readonly updatedAt: string
  }): Command<void> =>
    command(() => sql`
      INSERT INTO app_settings (id, visionModelId, familyName, updatedAt)
      VALUES (1, ${row.visionModelId}, ${row.familyName}, ${row.updatedAt})
      ON CONFLICT (id) DO UPDATE SET
        visionModelId = excluded.visionModelId,
        familyName = excluded.familyName,
        updatedAt = excluded.updatedAt
    `)

  return { find, upsert, updateWhere } as const
})

export interface AppSettingsRepo extends Effect.Success<typeof make> {}
export const AppSettingsRepo = Context.Service<AppSettingsRepo>("app/app-settings/AppSettingsRepo")
export const AppSettingsRepoLayer = Layer.effect(AppSettingsRepo, make)
