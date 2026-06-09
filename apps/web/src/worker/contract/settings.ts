import * as Schema from "effect/Schema"
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup"
import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint"
import { SettingsView } from "../views/setting.ts"
import { VISION_MODELS } from "../views/setting.ts"
import { HostOnly } from "./middleware/host-only.ts"

/**
 * The settings PATCH — partial: the Host may change the vision model and/or the family name. `visionModelId`
 * is constrained to a KNOWN model id at the boundary (an unknown id is a 400 decode failure — no custom
 * error, the contract is the single source of truth for what's valid), so the estimator never reads a
 * bogus model. The runtime membership check is what matters; the literal cast just satisfies the tuple type.
 */
export const UpdateSettings = Schema.Struct({
  visionModelId: Schema.optional(Schema.Literals(VISION_MODELS.map((m) => m.id) as [string, ...Array<string>])),
  familyName: Schema.optional(Schema.Trim.check(Schema.isMinLength(1), Schema.isMaxLength(40)))
})

/**
 * Settings — the instance config SINGLETON (no id; exactly one per deploy), host-only (`HostOnly`). `show`
 * (`GET /settings`) returns the current vision model + family name; `update` (`PATCH /settings`) edits them
 * (partial), returning the fresh view — the Host's only feedback that the model changed (the estimator
 * picks it up on the next Meal). The page is `/admin`; the resource is `settings` (ADR 0015 page-vs-resource).
 */
export const SettingsGroup = HttpApiGroup.make("settings")
  .add(HttpApiEndpoint.get("show", "/settings", { success: SettingsView }))
  .add(HttpApiEndpoint.patch("update", "/settings", { payload: UpdateSettings, success: SettingsView }))
  .middleware(HostOnly)
