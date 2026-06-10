# Sufra re-platform — sliced implementation plan

Companion to ADR 0009. The decisions live in `docs/adr/0009`–`0016`; this is the execution order.

## Strategy

Rebuild the backend onto the Effect + Cloudflare house style **in place** — transform `apps/web`, no parallel clone. **No backward compatibility**: delete the old Hono + Drizzle code as each replacement lands; no dual-stack coexistence against a shared, moving schema. **Nuke the DB and reset the migration baseline** — no data migration; collapse the 11 Drizzle migrations + the `0008` no-op into a fresh baseline (`0001_better_auth.sql` from the BA CLI + clean domain migrations). Work happens **on a branch** in tracer-bullet vertical slices. **Flip to main and deploy on a clean prod DB at parity** — the cutover criterion is feature parity, not incremental shipping (the app is dogfooding, so continuous delivery is low value).

Each slice is end-to-end through the layered `worker/` tree: **contract → models → db → domain → views → controllers → middleware → frontend**. A slice is done when its surface works through the typed client against local D1 + KV.

## Slices

### 1. Auth foundation
Realizes **ADR 0009, 0010, 0013, 0016**.

- **contract** — `contract/setup.ts`, the auth two-seam wiring; `contract/admin/members/password-link.ts` (host) + `contract/password-links.ts` (public token-addressed).
- **models** — `models/user.ts` (the thin Member-as-person root: `id`, `createdAt`, `updatedAt`), `models/password-link.ts`. `identities` is Better Auth's table (read-only `username`/`role`/`banned`).
- **db** — `db/users.ts`, `db/password-links.ts` (opaque token, 24h TTL, `UNIQUE` on `userId`, cascade); add `db/sql.ts` + `db/table.ts` (`makeTable`); `auth.cli.ts` generates `0001_better_auth.sql`.
- **domain** — `domain/password-link.ts` aggregate (`issue` / `show` / `redeem`); the `user.create.after` provision hook (`INSERT OR IGNORE` on the shared PK).
- **controllers / middleware** — `authentication` middleware producing `CurrentUser = {id, username, role}`; the `HostOnly` 404 gate (ADR 0013); thin controllers → `PasswordLink.*`. Better Auth on Kysely-D1, sessions in KV (`secondaryStorage`, `Math.max(ttl,60)`), one instance per isolate (build-once, cached at module scope).
- **views** — `password-links` show view (`{ username, familyName }`).
- **frontend** — `server.ts` two-seam handler (`/api/auth/*` → BA, `/api/*` → Effect, else SPA); typed `HttpApiClient` (`getClient` + `run`); `beforeLoad` auth gate.

**Delivers:** Setup creates the first Host; the Host provisions a Member by username; a Member redeems a PasswordLink and signs in. No email anywhere.

### 2. Meal
Realizes **ADR 0009, 0012, 0013, 0014, 0015**.

- **contract** — `contract/meals.ts` + `contract/meals/{override,refinement,saved,clones,photo}.ts`. Saved list is the scope `GET /meals?saved`.
- **models** — `models/meal.ts` (declares the optional `photo` slot — required-at-create, not `NOT NULL`), `models/attachment.ts`. The `Command` model; `Model.Class` as single source of truth.
- **db** — `db/meals.ts`, `db/attachments.ts` (one polymorphic `attachments` table); `blobs/` (`put`/`get`/`delete`).
- **domain** — the Meal aggregate composed of `-able` concerns (`Overridable`, `Refinable`, `Saveable`, `Cloneable`, `Attachable`); verbs `Meal.save`/`unsave`/`refine`/`clone`, grouped `Meal.override.set`/`.reset`. Synchronous-atomic create (persist only if the estimator succeeds; no status column). `estimator/` as an Effect service.
- **controllers / middleware** — `MealScoped` middleware (load-is-authorizing → 404 on miss); thin controllers nesting `override`/`refinement`/`saved`/`clones`/`photo` → `Meal.*`. `PUT`/`DELETE` override (kills the null-vs-absent PATCH bug); `POST` refinement (replaces Estimate in place); `POST`/`DELETE` saved (204 both); `POST /meals/:id/clones` (201 + new Meal); photo served via authenticated proxy `GET /meals/:id/photo`.
- **views** — meal view emits stable `photoUrl` (proxy path or `null`, non-effectful).
- **frontend** — capture → estimate → detail; override editor, Improve sheet (refine), bookmark toggle, clone/re-log; photo via base64-JSON typed upload (kills the raw-`fetch` hatches).

**Delivers:** the full meal lifecycle — capture, estimate, detail, override/refine/save/clone, attached photo.

### 3. Member
Realizes **ADR 0009, 0011** (preserves 0001/0002/0003/0007).

- **contract** — `contract/profile-snapshots.ts` (create-only), `contract/weights.ts` (`GET`/`POST`/`DELETE /:id`), `contract/me.ts`.
- **models** — `models/profile-snapshot.ts` (renamed from `profile_log`), `models/weight.ts`.
- **db** — `db/profile-snapshots.ts`, `db/weights.ts`.
- **domain** — fold profile + weights into the **one Member aggregate** (root = `users`), owning `Member.snapshots.*` + `Member.weights.*`. The effective-tomorrow seal + merge-from-latest + upsert-the-pending-snapshot rule lives **once** here (ADR 0002). Logging a Weight is one atomic dual-append (`atomically([weight, profile_snapshot])`).
- **controllers** — first `POST /profile-snapshots` is onboarding (same-day + seeds the first Weight); subsequent are effective-tomorrow upserts; sealed (no update/delete). `GET /me` reads the resolved current snapshot + derived Target/Maintenance/macros (never writes).
- **views** — `me` view derives at read (`snapshotFor` + `deriveProfile`, browser-safe). "Onboarded" derived from "has ≥1 snapshot," no column.
- **frontend** — onboarding wizard (first snapshot create), Profile page (per-field sheets → append), goal slider, log-weight sheet (atomic dual-append).

**Delivers:** onboarding, Profile edits (effective tomorrow), weight logging (atomic), `/me` with derived numbers.

### 4. Admin
Realizes **ADR 0009, 0013, 0016**.

- **contract** — `contract/admin/members.ts`, `contract/admin/cost.ts`, `contract/settings.ts`; `contract/admin/members/:id/password-link.ts` (issuance).
- **models** — reuse `models/user.ts`; `models/app-setting.ts`; `models/inference-run.ts` (audit log, decoupled — no FK to meal/user).
- **db** — `db/app-settings.ts`, `db/inference-runs.ts`.
- **domain** — member provisioning (BA `admin.createUser` → provision hook), PasswordLink issuance (`POST /admin/members/:id/password-link` — first-issue and reset the same path), settings (model selection), cost rollup over `inference_run`.
- **controllers / middleware** — all admin resources host-scoped + instance-wide behind the `HostOnly` 404 gate (ADR 0013); thin → `PasswordLink.*`, member CRUD, settings.
- **views** — member list, cost-per-range view, settings view.
- **frontend** — `/admin` route, member list with PasswordLink (🔑) action, cost view, model-select.

**Delivers:** Host provisions/deletes Members, issues PasswordLinks, selects the model, views cost. Non-hosts 404.

### 5. Progress
Realizes **ADR 0009, 0011** (calorie-history as a read-model).

- **contract** — `contract/calorie-history.ts` (`GET /calorie-history?from&to&bucket&tz`).
- **db / read-model** — a derived rollup over `meals` + `profile_snapshots` (no writes → not an aggregate); keeps `snapshotFor` + `deriveProfile`.
- **views** — per-bucket avg kcal + historical Target + color band; BMI band view (height-personalized kg axis); weight series (raw `weight_log` points).
- **frontend** — `/progress` route; custom SVG charts (calorie bars, weight chart with tap-to-delete, BMI strip) — no Recharts.

**Delivers:** the calorie-history report and the weight/BMI/intake views.

## Slice 2 — decisions landed (meals)

- **MealAnalysis unified on ONE Effect `Schema`** (`models/meal-analysis.ts`, browser-safe). The estimator
  DERIVES its provider JSON Schema from it (`Schema.toJsonSchemaDocument` → flattened to a `JSONSchema7`
  → AI SDK `jsonSchema()`) and DECODES the model output back through the SAME schema (the drift-net). Zod
  is gone from the new estimator. **Risk to watch:** an Effect-derived JSON Schema driving OpenRouter
  strict structured output is unproven here — the request tests never exercise it (they use the
  deterministic `EstimatorTest` layer selected on `ENVIRONMENT="test"`); the real path is exercised by
  the evals (Slice 5 repoint) + dogfooding. If a provider rejects the schema, the fallback is a
  hand-curated JSON Schema next to the Effect schema (drop single-source for the wire schema only).
- **Estimator is an env-swapped Effect service** (`estimator/{estimator,layers}.ts`): `EstimatorLive`
  (OpenRouter via the AI SDK) / `EstimatorTest` (deterministic), `EstimatorLayer(env)` selector — mirrors
  `MailerLayer`. Model selection still defaults to `DEFAULT_VISION_MODEL_ID` (the `app_settings` read
  lands in Slice 4). The decoupled `inference_run` audit is written by the Meal aggregate around every
  estimator call, success or failure.
- **Photo proxy serve fits the HttpApi cleanly** — `GET /meals/:id/photo` is a contract endpoint behind
  `MealScoped`; the controller returns a raw `HttpServerResponse.uint8Array` (a handler may return the
  success value OR a custom response) with the per-meal content type + an immutable private cache header.
  No seam special-casing needed.
- **AI daily quota — DEFERRED.** The old per-Member daily AI-call cap (the D1 `rate_limit` table bounding
  the host's OpenRouter bill) is NOT ported in Slice 2 (it isn't in the ADR'd surface). Re-add it as a
  small concern if dogfooding cost warrants — login throttling still rides the Workers Rate Limiting
  binding (`LOGIN_RATE_LIMITER`), unaffected.
- **Frontend reshaped (the meal surface + the seam).** New `src/client/{api-client,auth-client}.ts` (the
  typed `HttpApiClient` + the no-email better-auth client, SPA-only — no SSR/isomorphic branch). The Day
  view, meal detail, override editor (PUT-replace / DELETE-reset), Improve sheet (refinement), bookmark
  (POST/DELETE saved), clone, delete, and base64 photo upload all go through the typed client (the
  raw-`fetch` + Hono-RPC holes are gone). Auth is a per-route session gate (`authClient.getSession()` →
  redirect `/login`); the Setup + Onboarding gates and the Day-summary panel (which need the profile/admin
  backends) return with their slices.
- **Deferred frontend — `apps/web/deferred-frontend/`.** The not-yet-reshaped route trees (profile,
  onboarding, admin, progress, setup, set-password, how-it-works) + their components (day-summary-panel,
  log-weight-sheet, bottom-nav) were MOVED OUT of `src/` so the frontend compiles + the meal tracer bullet
  runs. **Slices 3-5 restore each tree from `deferred-frontend/` and reshape it in place** (the components
  are largely reusable — only the data seam changes). The old Hono/Drizzle `src/lib/{api,auth-*}` seam was
  deleted.

## Slice 3 — decisions landed (member)

- **One `User` aggregate, not a separate `domain/member.ts`.** ADR 0011 named the aggregate `Member`;
  Slice 1/2 settled the **`User`/`users` code-name** (handoff §3), so Slice 3 EXTENDS the existing
  `domain/user.ts` `User` aggregate with two grouped sub-namespaces — `User.snapshots.create` and
  `User.weights.{index,log,remove}` — rather than introducing a parallel `Member` symbol over the same
  `users` root. "Member" stays the product noun; the code reads `User.snapshots.*` / `User.weights.*`.
  Concerns are namespaced under `domain/user/{snapshots,weights}.ts`.
- **`GET /me` carries the whole Profile snapshot timeline + `isOnboarded`, not just a resolved current
  snapshot.** ADR 0011 phrased `/me` as "the resolved current snapshot + derived numbers"; in practice
  Day segmentation is client-side by the Member's TZ (ADR 0002/0003), so the server can't resolve
  "today." `/me` returns `{ id, username, role, isOnboarded, profiles[] }` (newest first); the SPA picks
  the active snapshot per day with `snapshotFor` and derives Target/macros with `deriveProfile` — both
  browser-safe in **`views/derive.ts`** (the ADR 0011 "snapshotFor + deriveProfile on the read side"
  note). The old `GET /profile` read folds into `/me`; there is no `PATCH /profile` and no separate
  profile read endpoint.
- **A Profile "edit" is an APPEND of a COMPLETE snapshot — payload = `ProfileSnapshot.jsonCreate`.** Not
  a partial PATCH. The client merges the changed field over the latest snapshot it already holds (from
  `/me`) and POSTs the whole thing + `effectiveFrom`. The aggregate owns the seal in ONE place: branch on
  "has a prior snapshot" → first = onboarding (same-day, seeds the first Weight, atomic dual-append),
  rest = effective-tomorrow upsert; `weightKg` is PINNED to the latest snapshot on an edit (ADR 0007 —
  weight flows only through `POST /weights`), honored only on onboarding. This is ADR 0011's
  "merge-from-latest in the aggregate" refined: the client assembles the complete snapshot; the server
  owns effective-tomorrow + the weightKg seal + seed-first-weight + upsert-the-pending-row. "Edited twice
  the same day" → `ON CONFLICT (userId, effectiveFrom) DO UPDATE` overwrites in place.
- **Weight id is a text UUID v7** (every app table; the old `weight_log` autoincrement integer is gone).
  `DELETE /weights/:id` is string-id'd, load-is-authorizing (find-through-user → 404 on a foreign/absent
  id). Logging is `atomically([weights.insert, snapshots.upsert])`; deleting touches only `weights`
  (sealed snapshots don't move — ADR 0007).
- **`models/profile-snapshot.ts` is the single source for the Profile vocabulary** — the enum tuples
  (`SEX_VALUES`/…), numeric bounds, AND the reusable field schemas (`Sex`/`WeightKg`/`LocalDate`/…),
  consumed by the model, the `weights` contract payload, and the frontend chips/sliders.
- **`/how-it-works` restored in Slice 3, not Slice 4.** The Day Summary ⓘ and Profile "Your numbers"
  deep-link into it; it's a static, ungated, auth-optional page with no backend dependency, so it had to
  come back with the Day Summary panel. (Slice 4's frontend list drops it.)
- **Onboarding gate is per-route `requireOnboarded(queryClient)`** (`client/gate.ts`): no session →
  `/login`; signed in, no snapshot → `/onboarding`; primes `/me`. Applied to `/`, `/meals/$id`,
  `/profile`. The onboarding submit invalidates `["me"]` with **`refetchType: "all"`** (nothing observes
  `/me` during onboarding, so an active-only invalidate would leave the gate reading stale
  not-onboarded data → redirect loop). The **Setup gate** (no Host → `/setup`) + the **bottom-nav** stay
  deferred (Slice 4 / Slice 5); Profile is reachable by URL until the nav lands.
- **AI daily quota still deferred** (carried from Slice 2). calorie-history (read-model) + the Progress
  views remain Slice 5, reusing `views/derive.ts`.

## Slice 4 — decisions landed (admin + setup + password-link)

- **Two HttpApis, one prefix: a second unauth `publicApi` solves the api-wide `Authentication` conflict.**
  `contract/public-api.ts` is `HttpApi.make("publicApi")` with `SetupGroup` + `PasswordLinksGroup`, NO
  middleware, same `.prefix("/api")`. `runtime.ts` builds it as a SEPARATE `toWebHandler` (`publicHandler`)
  sharing the same `dataLayer` + `Auth`. `handler.ts` dispatches the known public prefixes (`/api/setup`,
  `/api/password-links`, exact-or-child match so they can't shadow an authed route) to `publicHandler`,
  everything else `/api/*` to the authed `handler`. The frontend reaches it via a SECOND typed client
  (`getPublicClient`). This is the recommended shape from handoff-3 §5.1, confirmed by request tests.
- **Set-Cookie from a handler: `signInUsername({ returnHeaders:true })` → `getSetCookie()` →
  `HttpServerResponse.fromWeb(new Response(body, { headers }))`.** Setup-create and Password-link-redeem
  both create/overwrite a credential then sign the caller in; the handler returns a raw `HttpServerResponse`
  (the same "a handler may return a response instead of the success value" pattern the photo serve uses).
  The shared helper is `support/session-response.ts`. `getSetCookie()` returns each Set-Cookie un-combined;
  `fromWeb` round-trips the cookie collection so the runtime re-emits them. Verified: the setup/redeem
  request tests extract the cookie and authenticate the next request with it. (handoff-3 §5.2 resolved.)
- **Auth-instance primitives, not the admin HTTP endpoints, for role-flip / password-set / credential-delete.**
  `auth.$context.internalAdapter.{updateUser,updatePassword,deleteUser,deleteSessions}` + `$context.password.hash`
  (verified present in better-auth 1.6.12) — so the domain never threads request headers and never needs an
  admin session (Setup's role-flip happens before any admin exists; redeem's credential IS the token). The
  admin `setRole`/`createUser` HTTP endpoints are deliberately NOT used.
- **Member provisioning uses `signUpEmail` with an unreachable placeholder password** (the proven path the
  test harness already uses), NOT `admin.createUser`. ADR 0010 / handoff phrased it as `admin.createUser`;
  `signUpEmail` is the verified, simpler equivalent — it fires the `user.create.after` provision hook,
  lands `defaultRole = member`, and (called server-side without forwarding its Set-Cookie) doesn't disturb
  the Host's session. The Member sets a real password via a Password link. **Documented deviation.**
- **Member-create is PURE (returns the Member); the link is a SEPARATE issue (ADR 0016).** The frontend
  `AddMemberForm` chains `create` → `POST /admin/members/:id/password-link` → copy. No auto-issue. The link
  step is BEST-EFFORT (a review fix): once the Member exists the create must NOT be retried (username taken),
  so a link failure still reveals the Member in the list + shows a "tap the 🔑 to retry" toast.
- **Member-delete cascade is explicit (D1 has no FK cascade).** `User.members.destroy`: purge each meal's
  photo (R2 blobs + attachment rows, keyed per-meal via `meals.idsForUser` + `Attachable.purgeRecord`),
  then the credential FIRST (`internalAdapter.deleteSessions` + `deleteUser`), then ONE `atomically` batch
  (`meals` / `profile_snapshots` / `weights` / `password_links` / `users`). `inference_run` rows SURVIVE
  (decoupled audit). **Credential-FIRST** (a review fix — was last): not cross-system atomic (BA + D1), so a
  mid-sequence defect must never strand an account that can still *authenticate* — the security-sensitive
  half goes first; the worst case is then inaccessible leftover app rows no session can reach.
- **`HostOnly` is a PURE gate (provides nothing).** `contract/middleware/host-only.ts` requires
  `CurrentUser`, errors `NotFound`; `middleware/host-only.ts` is `Layer.effect(HostOnly, Effect.succeed(fn))`
  (no per-request capture) — `role !== "host"` → 404, else passes the endpoint through (`return yield*
  httpEffect`). Role is a scope; a non-host 404s exactly as a non-owner does (ADR 0013, no 403 anywhere).
  Attached per admin/settings group in each group's contract.
- **Admin member ops live on the ONE `User` aggregate** as `User.members.{index,create,destroy}`
  (instance-wide, host-only) — consistent with the Slice 3 "`User` aggregate, not `domain/member.ts`"
  decision. Distinct from the user-scoped `User.snapshots` / `User.weights`. `PasswordLink` / `Settings` /
  `Cost` / `Setup` are their own small aggregates (`domain/{password-link,settings,cost,setup}.ts`).
- **Schema role value is `member` (not the old `user`).** Member list/find + `countMembers` filter
  `role = 'member'`; `countHosts` filters `role = 'host'`. The credential reads (username/role) are
  inline-projection JOINs to `identities` in `db/users.ts` — never mirrored onto `users` (ADR 0010). The
  Admin cost per-Member average divides by `countMembers` (Host-EXCLUDING, matching the member list — a
  review fix; the old code divided by all accounts), and the public Setup `familyName` is trimmed at the
  contract boundary (`Schema.Trim`, restoring the old `.trim()` — a review fix).
- **Model selection closes the Slice 2 deferral.** `Meal.runEstimate` reads `Settings.visionModelId()` (the
  `app_settings` row), defaulted defensively to `DEFAULT_VISION_MODEL_ID` if the row is somehow absent (so a
  capture never 500s on a missing setting). `PATCH /settings` constrains `visionModelId` to a known model id
  at the contract boundary (a `Schema.Literals` over `MODELS` → 400 on an unknown id).
- **`app_settings` reset baseline drops the dead columns** (`default_language`,
  `deficit_safety_warning_enabled`) — translation + the deficit floor are deferred. The singleton is
  `id` (CHECK `id = 1`) + `visionModelId` + `familyName` (default `'My'`) + `updatedAt`. Seeded by Setup,
  edited from Admin.
- **`minPasswordLength: 6` added to the auth instance** to honor the 6-char Setup / set-password UI (Better
  Auth's default is 8, which would reject those passwords at `signUpEmail` / `updatePassword`).
- **Login rate-limit RESTORED (a re-platform regression).** The old `worker/routes/auth.ts` throttled
  `/api/auth/sign-in/*` per IP via `LOGIN_RATE_LIMITER`; the new direct auth seam had dropped it (handoff-2's
  "unaffected" was wrong). `handler.ts` now throttles POST sign-in before the Better Auth hand-off,
  env-gated OFF under `ENVIRONMENT="test"` (the harness signs in many times from one shared key).
- **Routes/verbs.** Setup is the singleton `GET /setup` (show = status) + `POST /setup` (create, 409
  `AlreadySetUp`). Public redeem: `GET /password-links/:token` (show) + `POST /password-links/:token/password`
  (create = redeem). Host issuance: `POST /admin/members/:id/password-link` (singular sub-resource, 200,
  upsert-in-place). Admin: `GET/POST /admin/members`, `DELETE /admin/members/:id`, `GET /admin/cost`.
  Settings: `GET/PATCH /settings` (top-level host-only singleton; the page is `/admin`).
- **Frontend Setup tier folded into `client/gate.ts`** above onboarding: `requireOnboarded` is now Setup →
  Login → Onboarding; `requireHost` gates `/admin`. `setupStatusQueryOptions` (`staleTime: Infinity`); the
  Setup submit invalidates it with `refetchType: "all"` + await before navigating (else the gate's
  `ensureQueryData` reads stale `needsSetup=true` and loops). `admin` / `setup` / `set-password` restored;
  the bottom-nav + Progress stay deferred to Slice 5 (admin is URL-reachable for now, like Profile).

## Slice 5 — decisions landed (progress + cleanup)

- **calorie-history read-model placement (the open follow-up): `domain/calorie-history.ts`, a read verb.**
  `CalorieHistory.index(query)` — no writes → NOT an aggregate-with-concerns, just a read verb (the
  `Cost.show` precedent). HTTP op `index` (`GET /calorie-history?from&to&bucket&tz`) → `Array(
  CalorieHistoryBucketView)`, user-scoped (CurrentUser via the api-wide auth; no resource middleware, like
  `/me` + `/weights`). It reads `MealsRepo.inRange` + `ProfileSnapshotsRepo.history`, then a PURE `rollup`
  (the TZ-bucketing + avg-over-logged-days + adherence color, ported verbatim from the old Hono module and
  co-located below the verb) reusing `views/meal.ts` `resolveTotals` + `views/derive.ts` `snapshotFor` /
  `deriveProfile`. The historical per-day Target honors the ADR 0002 seal (snapshotFor per day).
- **Estimator: `callVisionModel` extracted (`estimator/call.ts`) — the SHARED bare OpenRouter call.** The
  re-platform turned the estimator into an Effect service (`EstimatorLive`) the evals can't call directly,
  and the prod path is English-only — which broke the eval's "same code path / no schema-prompt drift"
  guarantee. Fix: `callVisionModel({ apiKey, modelId, photo, locale?, userText? })` is the one place that
  talks to OpenRouter (same model, system + user prompts, derived JSON Schema, `response_format`).
  `EstimatorLive` delegates to it (locale "en") keeping its typed-failure + audit wrapper; the evals call it
  directly and decode via the single-source `MealAnalysis`. The only knob the evals need that prod doesn't
  is `locale` (the plumbing). Closes the "evals import path" follow-up.
- **`apps/evals` repointed** to `../web/src/worker/estimator/{call,models}.ts` + `../web/src/worker/models/
  meal-analysis.ts`. Added `effect@4.0.0-beta.74` (transitively needed by the Effect-derived `MealAnalysis`)
  + `allowImportingTsExtensions` to the evals tsconfig; `include` drops the old worker glob (the new files
  are pulled in transitively via the imports). Evals typecheck clean.
- **The OLD `apps/web/worker/` is DELETED** (the two-worker-folder situation resolved — only the live
  `apps/web/src/worker/` remains), with the orphan `tsconfig.app.json` / `tsconfig.node.json` (dangling Vite
  scaffold, in no live build path) + the dead `drizzle.config.ts` (`drizzle-kit` isn't even installed) + the
  now-empty `deferred-frontend/`. **eslint:** dropped the `worker/**` + `deferred-frontend/**` global
  ignores AND the entire ADR 0005 `no-restricted-imports` "isomorphism boundary" rule — it was anchored to
  the deleted paths; the browser-safe boundary is now STRUCTURAL (the split tsconfig: server-only
  `src/worker/*` can't compile under the frontend's DOM scope). An explicit ESLint boundary rule for the new
  stack is a known, deliberate gap (fawwaz-coding-style "Known gaps").
- **Bottom-nav restored — 4 tabs (Today / Progress / Profile / Admin).** Reads `role` from `meQueryOptions`
  (primed by the route gate on every tab — no extra fetch); the Admin tab is host-only. Wired into the Day /
  Profile / Admin shells (Progress carries its own). **The Weight chart's `id` is now a string** (the new
  `weights` UUID-v7 id, not the old autoincrement int); its delete goes through the typed client.
- **`CalorieHistoryBucketView`** = `{ bucketStart, kcalAvg, targetAvg, color: "ok"|"warn"|"over"|null,
  daysWithData }` (`views/calorie-history.ts`, browser-safe). `kcalAvg` is avg over days-WITH-data (not ÷
  days-in-bucket — that would understate a partially-logged bucket); color thresholds match the Day view's
  week strip (≤Target green / 0–15% over yellow / >15% red).
- **CLAUDE.md rewritten** to the new Effect + Cloudflare architecture (the old file described the deleted
  Hono/Drizzle/zod stack + layout). It now points to the fawwaz-coding-style skill as the conventions
  authority and records the project-specific deltas.

## Open follow-ups (not yet decided — flag, don't invent)

- **Tooling specifics** — the skill `conventions:sync` wiring, the `auth:generate` script, the `kysely@0.28.17` pin, and the split tsconfig (browser-safe vs worker) boundary.
- ~~**Estimator evals import path**~~ — **CLOSED in Slice 5** (repointed to `callVisionModel` + single-source `MealAnalysis`).
- ~~**calorie-history read-model placement**~~ — **CLOSED in Slice 5** (`domain/calorie-history.ts`, a read verb; the `Cost.show` precedent).
- **The cutover (the only thing left before `main`)** — ops, needs Cloudflare creds: create prod + staging KV namespaces (the `wrangler.jsonc` ids are PLACEHOLDERs), set per-env secrets, nuke + migrate prod/staging D1 (no data migration), deploy, flip to `main`, delete memory `project_sufra_replatform`. See `docs/refactor-handoff-3.md §6`.
- **The future `packages/contract` lift** — extracting browser-safe `contract`/`models`/`views` into a shared package when Expo lands.
- **Future Member `displayName` + avatar** — the avatar via the `attachable` model; deferred.
