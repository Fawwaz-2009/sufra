# Sufra re-platform — handoff #3 (Slices 4–5 + cutover)

You are continuing the **in-progress re-platform** onto the **fawwaz-coding-style** (Effect v4 +
Cloudflare). **Slices 1 (auth), 2 (meals), and 3 (member) are DONE and verified.** This doc supersedes
`refactor-handoff-2.md` (written after Slice 2). It tells you *what's done*, *the patterns to mirror*,
*what's left (Slices 4–5 + cutover)*, and *the gotchas Slice 3 added* — read it before touching anything.

Branch: **`refactor/effect-cloudflare-rebuild`** · Slice 1: **`0353d16`** · Slice 2: **`84831fd`** ·
Slice 3: **see the latest commit on the branch ("Slice 3 — Member …")**.

---

## 0. Read these first (authoritative — don't re-derive)

1. **The skill** — `~/.claude/skills/fawwaz-coding-style/SKILL.md` + `references/*.md`. Read the relevant
   `references/<x>.md` IN FULL before building that layer. For Slice 4 that's **auth.md**,
   **rest-resources.md**, **middleware-and-authorization.md**, **persistence.md**.
2. **ADRs 0009–0016** (`docs/adr/`). Slice 4 realizes **0010, 0013, 0016**; Slice 5 realizes **0011**
   (calorie-history as a read-model).
3. **`docs/refactor-plan.md`** — the slice plan + a **"Slice N — decisions landed"** block per slice.
   **Read "Slice 2 — decisions landed" AND "Slice 3 — decisions landed"** (they record the deltas that
   aren't obvious from code). **Keep adding a block per slice.**
4. **CONTEXT.md** — domain glossary. Use the terms exactly.
5. **The THREE templates you now mirror** (in this repo): **Slice 1** (auth shell + `/me`), **Slice 2**
   (the whole Meal vertical — the richest worked example: aggregate + concerns, reified sub-resources, a
   side-effect service, media, a binary endpoint, request tests), and **Slice 3** (the Member vertical —
   a **user-scoped aggregate with no resource middleware**, a **create-only sealed collection** with an
   **upsert**, an **atomic dual-append**, a **browser-safe derive module**, and the **frontend gate +
   `/me` query**). `starting-fire` is the upstream gold standard for anything they didn't exercise.

## 1. How to work (the loop)

Each slice is a **vertical**, built + verified before the next: `contract → models → db → domain
(aggregate + concerns) → views → controllers → middleware → frontend`.

```
cd apps/web
pnpm exec tsc -p tsconfig.worker.json && pnpm exec tsc -p tsconfig.json   # typecheck (worker + frontend)
pnpm exec vitest run                                                      # all tests (unit + request)
pnpm exec wrangler d1 migrations apply DB --local                         # apply migrations to local D1
pnpm run lint                                                             # eslint
pnpm exec vite build                                                      # regenerates routeTree.gen.ts + proves the build
pnpm exec wrangler types                                                  # regen worker-configuration.d.ts after wrangler.jsonc changes
```

- **Local D1 conflict** ("table already exists"): nuke it — `rm -rf apps/web/.wrangler/state`, then re-apply.
- **Definition of done (per slice):** both tsconfigs clean · request tests green · that slice's frontend
  reshaped (restored from `deferred-frontend/` + re-seamed) · lint clean · commit.
- **The route-tree is gitignored + generated.** After moving/adding route files, `vite build` regenerates
  `src/routeTree.gen.ts` — until then `<Link to="/new-route">` and `redirect({to:"/new-route"})` won't
  typecheck. That's expected; build, then typecheck.

## 2. What's built (DON'T rebuild — copy the patterns)

### Slice 1 (auth) + Slice 2 (meals)
See `refactor-handoff-2.md` §2 (still accurate). Shell, `Command`/`makeTable`, Better Auth Kysely+KV
no-email, identities/users split, the request-test harness, the whole Meal vertical, the typed frontend
seam `src/client/{api-client,auth-client}.ts`.

### Slice 3 (member) — the template for a user-scoped aggregate + the frontend gate
- **models/** — `profile-snapshot.ts` (the SINGLE SOURCE for the Profile vocabulary: enum tuples +
  bounds + reusable field schemas `Sex`/`WeightKg`/`LocalDate`/…, used by the model AND the weights
  contract payload) + `weight.ts` (UUID-v7 id, not the old autoincrement int).
- **db/** — `profile-snapshots.ts` (`upsert` = INSERT … ON CONFLICT (userId, effectiveFrom) DO UPDATE …
  RETURNING *; `latest`; `history`) + `weights.ts` (custom void `insert` for the batch, `inRange`,
  `find`, `delete`).
- **domain/** — the **`User` aggregate EXTENDED** (NOT a new `Member` symbol — the `User`/`users`
  code-name won; see Slice 3 decisions): `domain/user/{snapshots,weights}.ts` concerns grouped as
  `User.snapshots.create` + `User.weights.{index,log,remove}`. The seal rule (effective-tomorrow +
  weightKg-pinned-on-edit + seed-first-weight-on-onboarding + upsert) lives ONCE in `snapshots.create`;
  the atomic dual-append (`atomically([weights.insert, snapshots.upsert])`) lives in `weights.log`.
- **views/** — `profile-snapshot.ts`, `weight.ts`, `me.ts` (`{id,username,role,isOnboarded,profiles[]}`),
  and **`derive.ts`** (Mifflin + `snapshotFor`, browser-safe — Slice 5's calorie-history reuses it).
- **contract/** — `profile-snapshots.ts` (create-only; payload IS `ProfileSnapshot.jsonCreate`) +
  `weights.ts` (GET/POST/DELETE). `me.ts` success is now `MeView`.
- **controllers/** — `profile-snapshots.ts`, `weights.ts` (`{ params }` reads the path id). No resource
  middleware — these are user-scoped (CurrentUser.id), so the repo reads/writes go `WHERE userId = …`.
- **frontend** — `src/client/me.ts` (`meQueryOptions` + `meKey`) + `src/client/gate.ts`
  (`requireOnboarded(queryClient)`); onboarding + profile + day-summary-panel + log-weight-sheet +
  how-it-works restored from `deferred-frontend/` and re-seamed to the typed client.
- **migrations** — `0006_profile_snapshots.sql`, `0007_weights.sql`. **test/** — `profile-snapshots`
  (5) + `weights` (5) request tests; `me` extended. 26 tests total, green.

## 3. Decisions already made (read `docs/refactor-plan.md` for the full blocks)

Slice 3 deltas you'll trip on if you miss them:
- **`User` aggregate, not `domain/member.ts`.** ADR 0011 says "Member"; the code-name is `User`/`users`.
- **`GET /me` returns the whole snapshot timeline + `isOnboarded`** (TZ day-segmentation is client-side;
  the SPA derives per-day with `views/derive.ts`). No `GET /profile`, no `PATCH /profile`.
- **A Profile edit is an APPEND of a COMPLETE snapshot** (`payload = ProfileSnapshot.jsonCreate`); the
  client merges the changed field over the latest. The aggregate owns the seal.
- **AI daily quota still deferred** (carried from Slice 2). calorie-history + Progress are Slice 5.

## 4. The two worker folders + what to PORT for Slices 4–5

- **`apps/web/worker/`** (outside `src/`) — the OLD Hono + Drizzle backend. **Dead** (not in
  `wrangler.jsonc`, eslint-ignored), retained as port-reference. **DELETE in Slice 5** (+ orphan
  `tsconfig.app.json`/`tsconfig.node.json`, + repoint `apps/evals`, + rewrite CLAUDE.md).
- **`apps/web/src/worker/`** (inside `src/`) — the NEW Effect backend. The live one.

Old files to PORT (read for exact behavior, reimplement in the new style):

| Slice | Old files to port |
|---|---|
| 4 (Admin) | `worker/routes/{setup,admin}.ts`; `worker/auth/password-link.ts`; `worker/auth/isomorphic/permissions.ts`; the `app_settings` + `inference_run` cost rollup |
| 5 (Progress) | `worker/calorie-history/{operations,schema}.ts` (the TZ-bucketing rollup; reuse the new `views/derive.ts`) |
| (schema shapes) | `worker/db/schema.ts` — column shapes for `app_settings`, `password_link` |

## 5. Slice 4 — Admin + Setup + PasswordLink (NEXT). ADR 0010/0013/0016.

The host-facing surface + the bootstrap. **Endpoints/verbs/status are in ADR 0012 + the resource ADRs.**

- **contract** — `contract/setup.ts`, `contract/admin/{members,cost}.ts`, `contract/settings.ts`,
  `contract/admin/members/password-link.ts` (host issuance), `contract/password-links.ts` (public,
  token-addressed).
- **models** — reuse `models/user.ts`; `models/app-setting.ts` (singleton, `id = 1` check);
  `models/inference-run.ts` ALREADY EXISTS (Slice 2) — add the read side; `models/password-link.ts`.
- **db** — `db/app-settings.ts`, `db/password-links.ts`; extend `db/inference-runs.ts` with a
  `sumByRange` read (the cost rollup; the table is decoupled — no FK).
- **domain** — `domain/password-link.ts` aggregate (issue / show / redeem); member provisioning (BA
  `admin.createUser` → the existing `user.create.after` provision hook); settings (model selection);
  cost rollup.
- **controllers / middleware** — a **`HostOnly` 404-gate** (the `MealScoped` shape, but it checks
  `CurrentUser.role === "host"` and 404s on a miss — role is a scope, ADR 0013). Admin resources are
  host-scoped + **instance-wide** (the Host acts across all Members). Scoped controllers declare only
  `HttpApiError.NotFound`.
- **migrations** — `0008_app_settings.sql`, `0009_password_links.sql`.

### The two genuinely-unsolved bits (handoff-2 flagged these — solve + DOCUMENT them):

1. **Unauth Setup + the public token endpoints break the api-wide `Authentication`.** Today
   `contract/api.ts` does `.middleware(Authentication)` over the WHOLE api, so every endpoint needs a
   session. Setup (`POST /api/setup`) and the public password-link redeem (`GET`/`POST
   /api/password-links/:token`) are **unauth**. Recommended shape: a **second `HttpApi.make("public")`**
   (no `Authentication` middleware, same `.prefix("/api")`) mounted alongside the authed `api`, both
   assembled in `runtime.ts` and dispatched in `handler.ts` (try the public router first, or compose both
   into one `HttpRouter`). Confirm against the skill's HttpApi composition before committing; **write the
   convention into `refactor-plan.md` Slice 4 decisions.**
2. **Setting the session cookie from a handler.** Setup creates the first Host and **signs them in** —
   the response must carry Better Auth's `Set-Cookie`. The clean path: call
   `auth.api.signUpEmail({ body, asResponse: true })` (or `signInUsername`/`signInEmail` with
   `asResponse: true`) which returns a **web `Response` with the Set-Cookie header**, and **return that
   raw `Response` via `HttpServerResponse`** from the handler — the SAME "a handler may return a raw
   `HttpServerResponse` instead of the success value" pattern the photo endpoint uses (handoff-2 §7).
   Verify `asResponse` exists in this Better Auth version (`node_modules/better-auth`) before relying on
   it; **document the verified mechanism in Slice 4 decisions.**

### Wire model-selection into the estimator (the Slice 2 deferral closes here)
Slice 2's `Meal.runEstimate` hard-passes `DEFAULT_VISION_MODEL_ID`. In Slice 4, read
`app_settings.visionModelId` (an `AppSettingsRepo`) and pass it instead. The Admin model-select writes it.

- **frontend** — restore `admin` + `setup` + `set-password.$token` from `deferred-frontend/`. Restore the
  **Setup gate** (no Host yet → `/setup`) — it needs a public `GET /api/setup/status` returning
  `{ needsSetup }`. Fold it into `client/gate.ts` (the Setup tier sits ABOVE the onboarding tier).

## 6. Slice 5 — Progress + cleanup + cutover. ADR 0011.

- **contract** — `contract/calorie-history.ts` (`GET /calorie-history?from&to&bucket&tz`).
- **read-model** — a derived rollup over `meals` + `profile_snapshots` (NO writes → not an aggregate;
  reuse `views/derive.ts`'s `snapshotFor` + `deriveProfile`, already browser-safe). Port the TZ-bucketing
  from the old `calorie-history/operations.ts`.
- **views** — per-bucket avg kcal + historical Target + color band; BMI band (height-personalized kg
  axis); weight series.
- **frontend** — restore `progress` + the **bottom-nav** (now all 4 tabs exist: Today / Progress /
  Profile / Admin). The Profile page + how-it-works currently have NO visible nav (Profile is
  URL-reachable); bottom-nav closes that.
- **cleanup** — delete `apps/web/worker/` + orphan tsconfigs; **repoint `apps/evals`** to the new
  estimator (its single-source `MealAnalysis`); **rewrite CLAUDE.md** to the new architecture.
- **cutover** (after Slice 5): nuke prod + staging D1; `wrangler kv namespace create` (prod + staging) +
  paste real ids into `wrangler.jsonc` (currently PLACEHOLDERs); set secrets per env; apply migrations
  `--remote`; deploy (`deploy:staging` keeps the dual `CLOUDFLARE_ENV=staging` + `--env staging`); flip to
  main; **delete memory `project_sufra_replatform`**.

## 7. Frontend restore (the per-slice mechanic — Slice 3 made it cheaper)

The not-yet-reshaped trees live in `apps/web/deferred-frontend/` (admin / setup / set-password / progress
+ `components/bottom-nav.tsx`). Per slice:

1. `git mv apps/web/deferred-frontend/routes/<x> apps/web/src/routes/<x>` (and any `components/*`).
2. **Mechanical import swaps** (a codemod is fastest — see how Slice 3 did it): old worker leaves →
   `@/worker/{models,views}/…`; `@/lib/api` (Hono RPC) → the typed client; `@/lib/auth-context` →
   `meQueryOptions` + `queryClient`. The old `MealListItem`/`ProfileSnapshot` type names map to
   `MealListItemView`/`ProfileSnapshotView` (alias `as` to keep bodies unchanged).
3. **Data seam** — loader reads via `getClient()`/`run()`; mutations call the typed client + INVALIDATE
   (never consume the response). The **auth gate is `requireOnboarded` (Slice 3)**; Slice 4 adds the
   **Setup tier** on top.
4. **`vite build`** to regenerate `src/routeTree.gen.ts`, then typecheck.

## 8. Gotchas — Effect-4-beta + the API facts (handoff-2 §7 still holds; Slice 3 additions below)

Carry forward **all** of handoff-2 §7 (Schema/Effect/HttpApi/HttpApiClient/middleware/AI-SDK/eslint
facts). New, VERIFIED-in-Slice-3 additions:

- **Schema checks:** `Schema.Finite.check(Schema.isBetween({ minimum, maximum }))`,
  `Schema.Int.check(Schema.isBetween({ minimum, maximum }))`, `Schema.String.check(Schema.isPattern(/…/))`.
  `isBetween` takes an **options object** `{ minimum, maximum, exclusiveMinimum?, exclusiveMaximum? }`,
  NOT positional args. `Schema.Literals([...])` for enums.
- **`Model.jsonCreate` IS the create payload** when the client sends the columns — it drops
  `UuidV7Insert` ids + `DateTimeInsert`/`DateTimeUpdate` + any `FieldExcept(["jsonCreate",…])` (server-set
  FKs). `select.Type` for a `DateTimeInsert` column decodes to a **DateTime object** (not a string) — keep
  it OUT of plain views, or convert.
- **Upsert (no `makeTable` helper for it):** hand-write `sql\`INSERT INTO t ${sql.insert(row)} ON CONFLICT
  ("a","b") DO UPDATE SET col = excluded.col, … RETURNING *\`` as a named repo command (decode rows[0]).
  The conflict target keeps the EXISTING row's id (the SET omits id) — so `run` the upsert for an edit to
  get the real id back; in an `atomically` batch the RETURNING is ignored (decode the built row instead).
- **Controller path params** are read as `({ params })` (e.g. `params.id`), NOT `({ path })`. (Client
  request key is also `params`.)
- **The frontend gate + cache (load-bearing):** `ensureQueryData` does **NOT** refetch stale data
  (`revalidateIfStale` defaults false) — it returns cached-if-present. So a mutation that changes
  gate-relevant state on a route that **doesn't observe** that query (e.g. onboarding doesn't `useQuery`
  `/me`) MUST invalidate with **`refetchType: "all"`** and `await` it, or the next `beforeLoad` gate reads
  stale data and loops. Routes that DO observe the query (Profile `useSuspenseQuery(me)`, Day view
  `useQuery(me)`) refetch on a default (active) invalidate.
- **Harness quirk:** the Write/Edit tools want a fresh Read of a file in the same turn before editing it
  (esp. files just `git mv`'d). Re-read right before editing.

## 9. Definition of done + cutover (after Slice 5)

- **Per slice:** both tsconfigs clean · request tests green · slice's frontend restored + re-seamed · lint
  clean · commit.
- **Cutover:** see §6. Update **CLAUDE.md** to the new architecture and **delete memory
  `project_sufra_replatform`**.

_No secrets here. The test `BETTER_AUTH_SECRET` in the request config is a throwaway; real secrets are
`wrangler secret`s / `.dev.vars` (gitignored)._
