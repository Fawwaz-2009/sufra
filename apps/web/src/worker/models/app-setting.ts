import * as Schema from "effect/Schema"
import * as Model from "effect/unstable/schema/Model"

/**
 * The app-settings singleton (CONTEXT "Setup") — instance config, exactly ONE row keyed `id = 1`. Holds
 * the Host-chosen vision model (read by the Meal estimator — `Settings.visionModelId`) and the family
 * name (the "{familyName} Sufra" copy on the set-password page). Created at Setup; the model is edited
 * from Admin. Table: `app_settings`.
 *
 * `id` is a fixed integer (always 1), provided server-side at Setup — never app-minted, never a client
 * write — so it is `FieldExcept(["jsonCreate", "jsonUpdate"])`, the same "server-owned but readable"
 * shape `users.id` uses. The reset baseline drops the old dead columns (`default_language`,
 * `deficit_safety_warning_enabled`) — translation + the deficit floor are deferred (CLAUDE.md).
 */
export class AppSetting extends Model.Class<AppSetting>("AppSetting")({
  id: Model.FieldExcept(["jsonCreate", "jsonUpdate"])(Schema.Int),
  visionModelId: Schema.String,
  familyName: Schema.String,
  updatedAt: Model.DateTimeUpdate
}) {}
