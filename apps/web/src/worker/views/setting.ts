import * as Schema from "effect/Schema"
import { AppSetting } from "../models/app-setting.ts"

/**
 * App settings as the Admin surface reads and edits them — the vision model the estimator uses and the
 * family name. Plain JSON. The singleton `id` and `updatedAt` audit stamp are intentionally omitted (the
 * Host edits values, not the row identity).
 */
export const SettingsView = Schema.Struct({
  visionModelId: Schema.String,
  familyName: Schema.String
})
export type SettingsView = typeof SettingsView.Type
export type SettingsViewEncoded = typeof SettingsView.Encoded

/** Serialize an app_settings row → its view. */
export const toSettingsView = (row: typeof AppSetting.select.Type): SettingsView => ({
  visionModelId: row.visionModelId,
  familyName: row.familyName
})
