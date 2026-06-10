import * as Schema from "effect/Schema"
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup"
import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint"
import { OkView, SetupStatusView } from "../views/setup.ts"

/**
 * Setup-create payload — the family name + the first Host's credentials (no email; sign-in is by
 * username). Mirrors the wizard's validation: family name 1–40, username 3+ word-chars, password 6+.
 */
export const CreateSetup = Schema.Struct({
  // Trim BEFORE length-checking (the old `z.string().trim().min(1)`), so a whitespace-only family name is
  // rejected and a padded one is stored trimmed — even on a direct POST that bypasses the wizard's trim.
  familyName: Schema.Trim.check(Schema.isMinLength(1), Schema.isMaxLength(40)),
  username: Schema.String.check(Schema.isMinLength(3), Schema.isPattern(/^[a-zA-Z0-9_]+$/)),
  password: Schema.String.check(Schema.isMinLength(6))
})

/**
 * A user-facing Setup failure — the deploy already has a Host, so Setup is closed forever (CONTEXT
 * "Setup"). Declared on `create`, rendered as a toast. (409 Conflict: the singleton already exists.)
 */
export class AlreadySetUp extends Schema.TaggedErrorClass<AlreadySetUp>()(
  "AlreadySetUp",
  { message: Schema.String },
  { httpApiStatus: 409 }
) {}

/**
 * Setup — the one-time, per-deploy bootstrap (CONTEXT "Setup"), a PUBLIC singleton (no session: it runs
 * before any Host exists, so it CANNOT sit behind the api-wide Authentication — it lives on the unauth
 * `publicApi`). `show` (`GET /setup`) reports whether Setup is still needed (the SPA's gate signal);
 * `create` (`POST /setup`) creates the first Host, seeds the `app_settings` singleton, and signs them in —
 * returning a raw response carrying Better Auth's session cookie (`{ ok: true }` body). Closed forever
 * after the first Host (`AlreadySetUp`).
 */
export const SetupGroup = HttpApiGroup.make("setup")
  .add(HttpApiEndpoint.get("show", "/setup", { success: SetupStatusView }))
  .add(
    HttpApiEndpoint.post("create", "/setup", {
      payload: CreateSetup,
      success: OkView,
      error: AlreadySetUp
    })
  )
