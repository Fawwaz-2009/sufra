# Sufra re-platform — handoff (Slices 2–5 + frontend)

You are picking up an **in-progress re-platform** of Sufra onto the **fawwaz-coding-style**
(Effect v4 + Cloudflare backbone). **Slice 1 (auth foundation) is DONE and verified.** Your job is
slices 2–5 + the frontend reshape. This doc gets you running fast; it does **not** repeat the *why*
(that's in the ADRs) — it tells you *what's done*, *what's decided*, *what to mirror*, and *exactly
what's left*.

Branch: **`refactor/effect-cloudflare-rebuild`** · Slice 1 commit: **`0353d16`**

---

## 0. Read these first (authoritative — don't re-derive)

1. **The skill** — `~/.claude/skills/fawwaz-coding-style/SKILL.md` and `references/*.md`. **Read the
   relevant `references/<x>.md` in full before building that layer** (don't work from the SKILL
   summary). Treat the conventions as settled — do **not** relitigate them; for a genuine gap, apply
   the conventions' *meta-wisdom* (see memory `feedback_follow_style_meta_wisdom`).
2. **ADRs 0009–0016** (`docs/adr/`) — every decision + its reasoning. The whole design is here.
3. **`docs/refactor-plan.md`** — the slice plan + open follow-ups.
4. **`CONTEXT.md`** — domain glossary (canonical terms). Use them exactly.
5. **The reference implementation:** `/Users/fawwaz.alharbi/Documents/projects/2026/starting-fire/apps/web`
   — the gold-standard app in this exact style. **Mirror it.** Slice 1 was built by mirroring it.

## 1. How to work (the loop)

Each slice is a **vertical**, built and verified before the next: `contract → models → db → domain
(aggregate + concerns) → views → controllers → migration → request test → frontend reshape`.

```
cd apps/web
pnpm exec tsc -p tsconfig.worker.json && pnpm exec tsc -p tsconfig.json   # typecheck (worker + frontend)
pnpm exec vitest run --project request                                    # request tests (workerd + real D1/KV)
pnpm exec wrangler d1 migrations apply DB --local                         # apply migrations to local D1
pnpm exec wrangler types                                                  # regen worker-configuration.d.ts after wrangler.jsonc changes
```

- **Local D1 conflict** ("table already exists"): we *nuke* the DB (ADR 0009) — `rm -rf apps/web/.wrangler/state` then re-apply.
- **Commit per slice** (Slice 1 is the model commit). Verify request tests green before committing.

## 2. What's built in Slice 1 (DON'T rebuild — copy the patterns)

All of `apps/web/src/worker/` below typechecks; `migrations/` applies; `test/worker/controllers/me.request.test.ts` is **3/3 green**.

- **Shell:** `src/server.ts` (entry: size-gate → `serveBackend` ?? `env.ASSETS`), `worker/handler.ts`
  (two-seam: `/api/auth/*`→BA, `/api/*`→Effect, else SPA), `worker/app.ts` (build-once-per-isolate +
  provision bridge), `worker/runtime.ts` (HttpApi assembly), `worker/env.ts`, `worker/config.ts`.
- **Persistence:** `worker/db/sql.ts` (`Command`/`run`/`atomically`/`command`/`SqlLayer`),
  `worker/db/table.ts` (`makeTable`) — **generic, ported verbatim from starting-fire; reuse as-is.**
- **Auth:** `worker/auth/instance.ts` (Kysely-D1 + KV sessions + username/admin, no email,
  provision hook, `Auth` service), `worker/auth/permissions.ts` (ac + host/member roles),
  `worker/contract/middleware/authentication.ts` (`CurrentUser` {id,username,role} +
  `Authentication` decl), `worker/middleware/authentication.ts` (session→CurrentUser bridge).
- **`/me` vertical (the template for every resource):** `models/user.ts` (thin `Model.Class`),
  `db/users.ts` (`UsersRepo.provision`), `views/user.ts` (`UserView`), `domain/user.ts` (`User`
  aggregate — `show`/`provision`), `contract/me.ts` (`MeGroup`), `controllers/me.ts`,
  `contract/api.ts` (root + api-wide `Authentication`).
- **Test harness (your verification backbone):** `test/support/{harness,setup,worker-entry,cloudflare-test.d}.ts`
  + `vitest.config.ts` + `vitest.request.config.ts`. `signInAs(username, {role})` creates an identity
  via internal `signUpEmail` + signs in via `/api/auth/sign-in/username`; `cleanDb()` truncates D1 + KV.

## 3. Decisions ALREADY made (so you don't re-derive them)

These are Sufra's deltas from the starting-fire reference — already applied in Slice 1, apply them everywhere:

- **No email.** Username + password + the `admin` plugin (NOT emailOTP). `CurrentUser = {id, username, role}`.
- **SPA, not TanStack Start** (ADR 0015). `src/server.ts` falls back to `env.ASSETS.fetch`. The frontend
  stays plain TanStack Router + `main.tsx` `createRoot`. No `server-fns/`, no SSR.
- **Media: proxy serve, not presigned** (ADR 0014). When you build `attachable`, **drop** `signGetUrl`,
  `aws4fetch`, the R2 S3 creds, the `BlobsLive`/`BlobsLocal` env-swap, the `/files` dev route, the
  effectful-view-signing, and the TTL==staleTime rule. `Blobs` = `put`/`get`/`delete` only. Serve via a
  Worker route (`GET /api/meals/:id/photo`), owner-scoped → 404.
- **Code name = `User`/`users`; product noun = "Member".** Role values `host | member`. (CONTEXT: "schema
  says user".) `role`/`username`/`banned` live on `identities`; the `users` row is the thin person.
- **404 everywhere, no 403** (ADR 0013). Scoped-find IS authorization; a Host-only route 404s a non-host
  (role is just another scope). Build a `HostOnly` middleware that 404s — never 403.
- **Bindings:** R2 is **`BUCKET`** (not MEDIA); KV is **`KV`** (placeholder ids — see §6).
- **Migrations:** plain SQL in `apps/web/migrations/`, applied by wrangler. No Drizzle, no meta/journal.

## 4. Reference map: starting-fire → Sufra

| Layer | Mirror this in starting-fire | Notes for Sufra |
|---|---|---|
| `db/sql.ts`, `db/table.ts` | same | **done, reuse verbatim** |
| `models/<x>.ts` | `models/user.ts`, `models/attachment.ts` | `Model.Class`; JSON columns = a gap (§6) |
| `db/<x>.ts` | `db/users.ts`, `db/attachments.ts` | `makeTable` + named read `Command`s |
| `domain/<x>.ts` + concerns | `domain/user.ts`, `domain/concerns/attachable.ts` | `Effect.fn` verbs; `-able` concerns; aggregate is sole importer |
| `contract/<x>.ts`, `views/<x>.ts`, `controllers/<x>.ts` | `contract/user.ts` + `user/avatar.ts`, `views/user.ts`, `controllers/user.ts` | + `references/rest-resources.md` |
| media | `models/attachment.ts`, `db/attachments.ts`, `domain/concerns/attachable.ts`, `blobs/blobs.ts`, `contract/upload.ts`, `migrations/0002_attachments.sql` | **adapt to proxy serve** (§3) |

## 5. Domain logic to PORT from the old `worker/` (still in the tree as reference)

The old Hono+Drizzle `apps/web/worker/` is **dead** (not in any tsconfig, not built) but **retained as
port-reference**. Read it for exact behavior, reimplement in the new style. Delete it (+
`tsconfig.app.json`, `tsconfig.node.json`, the old `src/lib/api.ts`/auth-context/provider) once ported,
and **repoint `apps/evals`** (it imports the old estimator path).

- **Estimator:** `worker/meals/estimator/{index,schema,prompts,errors}.ts` + `worker/meals/isomorphic/models.ts` (MODELS, computeCost). → an `Estimator` Effect service (§Slice 2).
- **Totals:** `worker/meals/isomorphic/totals.ts` (`resolveTotals` = override-first). → a view/isomorphic helper.
- **Profile math:** `worker/profile/isomorphic/derive.ts` (Mifflin, `deriveProfile`, `snapshotFor`) + `constants.ts`. → Member read-side.
- **Meal ops** (exact behavior of create/override/refine/clone/saved/delete): `worker/meals/operations.ts`.
- **Profile/weights/calorie-history ops:** `worker/{profile,weights,calorie-history}/operations.ts`.
- **Setup, admin, password-link:** `worker/routes/{setup,admin}.ts`, `worker/auth/password-link.ts`, `worker/auth/isomorphic/permissions.ts`.
- **Schema (column shapes):** `worker/db/schema.ts`.

## 6. Gotchas (READ before building)

- **Estimator in tests:** `OPENROUTER_API_KEY` is a placeholder in `vitest.request.config.ts`. Make the
  `Estimator` an env-swapped service with an `EstimatorTest` layer returning a deterministic
  `MealAnalysis` (the `MailerTest` pattern from `references/mail.md`), selected for `ENVIRONMENT="test"`,
  so meal-create request tests never hit OpenRouter. **Load the `ai-sdk` skill before touching the
  estimator** (memory `feedback_ai_sdk_skill`).
- **JSON columns** (`meal.aiAnalysis`, `meal.override`): no starting-fire example. Store as TEXT JSON via
  a Schema JSON codec on the `Model.Class` field (e.g. `Schema.parseJson(MealAnalysis)`); verify the
  decode/encode round-trips through `makeTable`. Small gap — solve it cleanly and note it back to the skill.
- **Unauthenticated endpoints** (Setup, public password-link redeem): `contract/api.ts` applies
  `Authentication` **api-wide**. Public groups must omit it — restructure to **per-group** `Authentication`
  (or a second unauth api). Decide in Slice 4, document the choice.
- **KV namespace ids are PLACEHOLDERS** in `wrangler.jsonc` (prod + staging). Local `vite` dev simulates
  KV. Before any **remote** deploy: `wrangler kv namespace create` and paste real ids.
- **better-auth password min length is 8** (the harness uses a 13-char password).
- **Setup needs to set the session cookie** from an Effect handler (better-auth `signInUsername`
  returns `Set-Cookie`). Either propagate headers from the handler or handle Setup in the seam like the
  BA routes — figure out the clean Effect-HttpApi way and document it.
- After any `wrangler.jsonc` binding change: `pnpm cf-typegen`.

## 7. Remaining slices

**Endpoints, verbs, status codes, cardinality are all specified in ADR 0012** (and the resource list in
ADR 0011/0014/0016). Summary of what each slice delivers — read the ADRs for the contract:

- **Slice 2 — Meals (NEXT, biggest).** The `Meal` aggregate (`index` w/ `?from&to` + `?saved` scopes,
  `show`, `create` [base64 photo → estimate-gated], `destroy`) + reified `override` (PUT/DELETE singular),
  `refinement` (POST singular, replaces estimate in place), `saved` (POST/DELETE singular toggle, 204),
  `clones` (POST plural create-only, 201). `-able` concerns. **Media via `attachable`** (proxy serve,
  optional `photo` slot on the Meal model, base64 `Upload` + sniff + typed errors,
  `GET /api/meals/:id/photo`). **Estimator as an Effect service** (+ `EstimatorTest`). **`inference_run`**
  audit (decoupled, survives meal delete). Migrations: `0003_meals.sql` (no `photoR2Key` — photo is an
  attachment), `0004_attachments.sql` (mirror starting-fire's; non-unique slot index), `0005_inference_runs.sql`.
- **Slice 3 — Member.** Aggregate absorbs `profile_snapshots` + `weights` (ADR 0011). `/me` composes the
  resolved current profile (`deriveProfile`). `POST /api/profile-snapshots` (first=onboarding same-day +
  seed first weight; rest=effective-tomorrow upsert; sealed). `weights` (POST = atomic dual-append).
  `GET /api/calorie-history` (read-model). Migrations: `0006_profile_snapshots.sql` (renamed from
  `profile_log`), `0007_weights.sql`.
- **Slice 4 — Admin + Setup + PasswordLink.** Setup (`POST /api/setup`, unauth, first host). Host-only
  admin surface (`/api/admin/members`, `/api/admin/cost`, `GET/PATCH /api/settings`) behind the `HostOnly`
  404-gate. `PasswordLink` (ADR 0016): host issues `POST /api/admin/members/:id/password-link`; public
  `GET`/`POST /api/password-links/:token`. `app_settings` singleton. Migrations: `0008_app_settings.sql`,
  `0009_password_links.sql`.
- **Slice 5 — Progress + cleanup.** Progress read views (weight/BMI/calorie history). Delete the old
  `worker/` + orphan tsconfigs + repoint `apps/evals`.

## 8. Frontend reshape (spans slices 2–5)

The whole `src/` still imports the OLD worker (Hono `AppType` via `lib/api.ts` + the `isomorphic/`
helpers) — **currently broken on this branch, as expected.** Reshape the *data seam* per slice; the ~80
components are largely reusable.

- Build `src/client/api-client.ts` — the typed Effect `HttpApiClient` from `worker/contract/api.ts`
  (`getClient` + `run`). Mirror starting-fire's `client/api-client.ts` but **SPA-only**: `getClient`
  resolves `window.location.origin` always (drop the SSR `createIsomorphicFn` server branch).
- `src/client/auth-client.ts` — better-auth react client (`usernameClient` + `adminClient` with the
  `ac`/roles from `worker/auth/permissions.ts`).
- Reads: loader `ensureQueryData` + `useSuspenseQuery`; `queryFn = run((await getClient()).<group>.<verb>(...))`.
  Writes: `useMutation` + `invalidateQueries` (never consume the response). The colocated
  `-queries.ts`/`-components/`/`-search.ts` convention (ADR 0006) carries over.
- Auth gate: `beforeLoad` → `authClient.getSession()` → redirect `/login` (the skill's non-Start variant
  in `references/auth.md`). Replace the `AuthProvider` Promise.all bootstrap.
- The multipart photo upload + the override raw-`fetch` both become typed client calls (base64 `Upload`).

## 9. Suggested skills

- **`fawwaz-coding-style`** — the conventions. Read the relevant `references/*.md` per layer.
- **`ai-sdk`** — before touching the estimator (Vercel AI SDK changes fast; memory `feedback_ai_sdk_skill`).
- **`grill-with-docs`** (or `grill-me`) — if a design question arises that the ADRs don't settle. Surface
  the gap, decide against the lineage, update the ADR/CONTEXT — don't invent silently.
- The request-test pattern (`references/testing.md`) — verify every slice.

## 10. Definition of done

- **Per slice:** both tsconfigs typecheck clean · request tests green · that slice's frontend reshaped · commit.
- **Cutover (after Slice 5):** nuke prod + staging D1 (no data migration), `wrangler kv namespace create`
  (prod + staging) + paste ids, set secrets per env (`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
  `OPENROUTER_API_KEY`), apply migrations `--remote`, deploy (the `deploy:staging` dual-flag
  `CLOUDFLARE_ENV=staging` + `--env staging` is preserved). Update `CLAUDE.md` to the new architecture and
  delete memory `project_sufra_replatform`.

_No secrets in this doc: the test `BETTER_AUTH_SECRET` in `vitest.request.config.ts` is a throwaway
placeholder; real secrets are `wrangler secret`s / `.dev.vars` (gitignored)._
