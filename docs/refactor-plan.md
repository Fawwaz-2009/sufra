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

## Open follow-ups (not yet decided — flag, don't invent)

- **Tooling specifics** — the skill `conventions:sync` wiring, the `auth:generate` script, the `kysely@0.28.17` pin, and the split tsconfig (browser-safe vs worker) boundary.
- **Estimator evals import path** — `evals/estimator-provider.ts` still imports the OLD zod leaf; repoint
  it to the new Effect estimator (and its single-source `MealAnalysis`) in Slice 5.
- **calorie-history read-model placement** — exactly where it lives; read-models are a gap in the skill.
- **The future `packages/contract` lift** — extracting browser-safe `contract`/`models`/`views` into a shared package when Expo lands.
- **Future Member `displayName` + avatar** — the avatar via the `attachable` model; deferred.
