import * as Effect from "effect/Effect"
import * as Clock from "effect/Clock"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import * as HttpApiError from "effect/unstable/httpapi/HttpApiError"
import { Auth } from "../auth/instance.ts"
import { UsersRepo } from "../db/users.ts"
import { AppSettingsRepo } from "../db/app-settings.ts"
import { PasswordLinksRepo } from "../db/password-links.ts"
import { run } from "../db/sql.ts"
import { CurrentUser } from "../contract/middleware/authentication.ts"
import { PasswordLink as PasswordLinkModel, PASSWORD_LINK_TTL_MS } from "../models/password-link.ts"
import { signInResponse } from "../support/session-response.ts"
import { orNotFound } from "../support/http.ts"
import type { PasswordLinkIssuedView, PasswordLinkShowView } from "../views/password-link.ts"

const nowMillis = Clock.currentTimeMillis

/** An opaque, URL-safe credential — 32 random bytes, base64url, no padding. Possession IS the credential. */
const mintToken = (): string => {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  let s = ""
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

/**
 * The Password link aggregate (ADR 0016) — the no-email credential handoff. Split across two REST
 * surfaces: host-only `issue` (the member's singular `password-link` sub-resource) and the public,
 * token-addressed `show` / `redeem`. The Better Auth instance stays delivery-free — the Host hands the
 * link over out of band.
 *
 *  - issue  — verify the target is a Member (404 else — the role-scoped find IS the gate), mint a token,
 *    upsert the single link (24h TTL, regenerate-in-place), return the token + expiry.
 *  - show   — validate the token (absent/expired → uniform 404), return the Member's username + family name.
 *  - redeem — validate the token, set the password (hash via the configured scrypt hasher + the internal
 *    adapter — the token, not an admin session, is the credential), consume the link, sign in.
 */
const issue = Effect.fn("PasswordLink.issue")(function* (input: { readonly memberId: string }) {
  const { id: hostId } = yield* CurrentUser
  const users = yield* UsersRepo
  const links = yield* PasswordLinksRepo

  yield* run(users.findMember(input.memberId)).pipe(orNotFound)

  const ms = yield* nowMillis
  const expiresAt = new Date(ms + PASSWORD_LINK_TTL_MS).toISOString()
  const row = Schema.encodeSync(PasswordLinkModel.insert)(
    PasswordLinkModel.insert.make({ userId: input.memberId, token: mintToken(), createdBy: hostId, expiresAt })
  )
  const saved = yield* run(links.upsert(row))
  return { token: saved.token, expiresAt: saved.expiresAt } satisfies PasswordLinkIssuedView
})

const show = Effect.fn("PasswordLink.show")(function* (input: { readonly token: string }) {
  const links = yield* PasswordLinksRepo
  const users = yield* UsersRepo
  const settings = yield* AppSettingsRepo

  const link = yield* run(links.findByToken(input.token))
  const ms = yield* nowMillis
  if (Option.isNone(link) || Date.parse(link.value.expiresAt) < ms) return yield* new HttpApiError.NotFound()

  const username = yield* run(users.usernameOf(link.value.userId))
  if (Option.isNone(username)) return yield* new HttpApiError.NotFound()
  const config = yield* run(settings.find())
  const familyName = Option.isNone(config) ? "My" : config.value.familyName
  return { username: username.value, familyName } satisfies PasswordLinkShowView
})

const redeem = Effect.fn("PasswordLink.redeem")(function* (input: {
  readonly token: string
  readonly password: string
}) {
  const auth = yield* Auth
  const links = yield* PasswordLinksRepo
  const users = yield* UsersRepo

  const link = yield* run(links.findByToken(input.token))
  const ms = yield* nowMillis
  if (Option.isNone(link) || Date.parse(link.value.expiresAt) < ms) return yield* new HttpApiError.NotFound()

  const username = yield* run(users.usernameOf(link.value.userId))
  if (Option.isNone(username)) return yield* new HttpApiError.NotFound()

  const ctx = yield* Effect.tryPromise(() => auth.$context).pipe(Effect.orDie)
  const hashed = yield* Effect.tryPromise(() => ctx.password.hash(input.password)).pipe(Effect.orDie)
  yield* Effect.tryPromise(() => ctx.internalAdapter.updatePassword(link.value.userId, hashed)).pipe(Effect.orDie)
  yield* run(links.deleteByToken(input.token))

  return yield* signInResponse(auth, username.value, input.password)
})

export const PasswordLink = { issue, show, redeem } as const
