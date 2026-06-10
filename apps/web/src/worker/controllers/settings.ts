import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder"
import { api } from "../contract/api.ts"
import { Settings } from "../domain/settings.ts"

/** Settings — show / update the instance config singleton, thin → the Settings aggregate (host-only). */
export const SettingsControllerLive = HttpApiBuilder.group(api, "settings", (handlers) =>
  handlers.handle("show", () => Settings.show()).handle("update", ({ payload }) => Settings.update(payload))
)
