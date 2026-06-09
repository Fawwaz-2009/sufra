import * as Effect from "effect/Effect"
import * as Clock from "effect/Clock"
import { Auth } from "../auth/instance.ts"
import { UsersRepo } from "../db/users.ts"
import { AppSettingsRepo } from "../db/app-settings.ts"
import { run } from "../db/sql.ts"
import { AlreadySetUp, type CreateSetup } from "../contract/setup.ts"
import { DEFAULT_VISION_MODEL_ID } from "../views/setting.ts"
import { signInResponse } from "../support/session-response.ts"
import type { SetupStatusView } from "../views/setup.ts"

const nowIso = Effect.map(Clock.currentTimeMillis, (ms) => new Date(ms).toISOString())

/**
 * Setup — the one-time, per-deploy bootstrap (CONTEXT "Setup"). Public (no session — it runs before any
 * Host exists).
 *
 *  - status — `GET /setup`: whether the deploy still needs Setup (zero Hosts). The SPA's gate signal.
 *  - create — `POST /setup`: create the first Host. Gated on "zero Hosts" (else `AlreadySetUp` — closed
 *    forever). `signUpEmail` creates the identity (defaultRole `member`) + fires the user.create.after
 *    hook that provisions the `users` row; we then flip the role to `host`. The admin `setRole` endpoint
 *    needs an admin session and none exists yet (the chicken-and-egg), so we drop to the internal adapter
 *    — the same primitive level the redeem path uses for the password hash. Then seed the app_settings
 *    singleton and sign in (a raw Set-Cookie response).
 */
const status = Effect.fn("Setup.status")(function* () {
  const users = yield* UsersRepo
  const hosts = yield* run(users.countHosts())
  return { needsSetup: hosts === 0 } satisfies SetupStatusView
})

const create = Effect.fn("Setup.create")(function* (input: typeof CreateSetup.Type) {
  const auth = yield* Auth
  const users = yield* UsersRepo
  const settings = yield* AppSettingsRepo

  const hosts = yield* run(users.countHosts())
  if (hosts > 0) return yield* new AlreadySetUp({ message: "This Sufra is already set up." })

  const created = yield* Effect.tryPromise(() =>
    auth.api.signUpEmail({
      body: {
        email: `${input.username}@sufra.local`,
        password: input.password,
        name: input.username,
        username: input.username
      }
    })
  ).pipe(Effect.orDie)

  const ctx = yield* Effect.tryPromise(() => auth.$context).pipe(Effect.orDie)
  yield* Effect.tryPromise(() => ctx.internalAdapter.updateUser(created.user.id, { role: "host" })).pipe(Effect.orDie)

  const now = yield* nowIso
  yield* run(
    settings.upsert({ visionModelId: DEFAULT_VISION_MODEL_ID, familyName: input.familyName, updatedAt: now })
  )

  return yield* signInResponse(auth, input.username, input.password)
})

export const Setup = { status, create } as const
