# Sufra — Agent Orientation

Three things anchor this codebase. Read the relevant one **before** you act:

- **The house style — `~/.claude/skills/fawwaz-coding-style/`** (SKILL.md + `references/*.md`). Sufra's
  backend AND frontend are built on these Effect v4 + Cloudflare conventions. **Read the relevant
  `references/<x>.md` IN FULL before building that layer** — where a file goes, what it's called, how a
  resource is shaped, how auth is read, how an error becomes a status are all decided there, so the
  thinking goes to the **domain**, not the plumbing. Don't reinvent a pattern the skill already settles.
- **`CONTEXT.md`** — the domain glossary. Canonical terms (Meal, Estimate, Override, Refinement, Total,
  Confidence, Clarification, Day, Target, Maintenance, Host, Member, Identity, Setup, Onboarding, Profile
  snapshot, Weight, Progress, Password link, Saved Meal, …). Read first whenever you name something.
  **Use this vocabulary exactly in code, comments, commit messages, and PRs.**
- **`PRD.md`** — product decisions, milestones, positioning, open questions (§10).

`docs/adr/0001–0020` record the architecture decisions (0009–0016 are the Effect + Cloudflare re-platform;
0017 reifies the Estimate as an append-only child + settles the third-party-API convention; 0018 makes the
native client backend-agnostic — the server origin is user state, bring-your-own backend; 0019 adds the
userText creation door — the description rides the Estimate, the Meal keeps one shape; 0020 adds Arabic +
RTL — the Locale is CLIENT state riding the Estimate-creating request, Lingui on mobile, history is history);
`docs/refactor-plan.md` records the re-platform's per-slice decisions. This file is the short orientation.

## What this is

A photo-first calorie tracker for households. **Host-deployed** on the Host's own Cloudflare account,
**host-paid inference**, multi-user (the Host provisions accounts for Members). PWA; **English + Arabic
with full RTL on the mobile app + the AI output (ADR 0020)** — the web SPA and marketing deliberately
stay English; Middle Eastern cuisine as a first-class citizen.

## Stack

Backend **and** frontend run on **one Cloudflare Worker** (the Rails / 37signals tradition), in the
**fawwaz-coding-style** (Effect v4-beta). The pre-2026 Hono + Drizzle + zod stack is gone — don't look for it.

- **Backend:** an **Effect `HttpApi`** on Cloudflare Workers (no Hono). D1 via Effect's SQL stack
  (`@effect/sql-d1` + a thin `Command` / `makeTable` layer — **no Drizzle anywhere**). One Worker serves
  the SPA assets and `/api/*`.
- **Auth:** **Better Auth** on the **Kysely-D1 dialect** (not Drizzle), sessions in **Cloudflare KV** via
  `secondaryStorage`; `username` + `admin` plugins; **no email anywhere** (username + password).
- **Frontend:** Vite + React 19 + **TanStack Router** (file-based, `beforeLoad` gate + loader +
  `useSuspenseQuery`) + TanStack Query + Tailwind v4 + shadcn. The browser reaches the backend ONLY over
  HTTP, through a **typed `HttpApiClient` derived from `worker/contract`** (no codegen). SPA, not SSR
  (ADR 0015).
- **Storage:** Cloudflare R2 (binding `BUCKET`) via a `Blobs` service; photos serve through the
  **authenticated Worker proxy** `GET /api/meals/:id/photo`, never a public/presigned URL (ADR 0014).
- **Inference:** OpenRouter via the AI SDK, baked INTO the Meal domain as the `estimatable` concern
  (`domain/meal/estimatable/`), NOT a subsystem (ADR 0017 — the integration isn't the hero, the domain is).
  The humble call is `estimatable/vision.ts` (`callVisionModel`, Effect-free, shared by prod AND the eval
  harness so they never drift); the env-swapped `Vision` service (`estimatable/service.ts` —
  `VisionLive`/`VisionTest`) is just the test stub.
- **Monorepo:** pnpm workspaces + Turborepo. `apps/web` (SPA + Worker, kept together — the Cloudflare
  Vite plugin glues them) + `apps/evals` (promptfoo harness; imports the prod `callVisionModel` + the
  single-source `Analysis`) + `apps/mobile` (the Expo client — see the Mobile section below).

## Run it

The work loop runs **from `apps/web`** (root scripts proxy through turbo/pnpm filters):

```
cd apps/web
pnpm exec tsc -p tsconfig.worker.json && pnpm exec tsc -p tsconfig.json   # typecheck (worker + frontend — two scopes)
pnpm exec vitest run                                                      # all tests (unit + in-process request tests)
pnpm exec wrangler d1 migrations apply DB --local                        # apply migrations to local D1
pnpm run lint                                                            # eslint
pnpm exec vite build                                                     # regenerates src/routeTree.gen.ts (gitignored) + proves the build
pnpm exec wrangler types                                                 # regen worker-configuration.d.ts after wrangler.jsonc changes
pnpm run auth:generate                                                   # regen migrations/0001_better_auth.sql after a BA upgrade/plugin
```

- **Two typecheck scopes are intentional** (the browser-safe boundary, below): `tsconfig.worker.json`
  (Worker globals, no DOM) for `src/worker` + `src/server.ts` + tests; `tsconfig.json` (DOM, no Worker
  globals) for the frontend, which may import only the browser-safe `src/worker/{contract,models,views}`.
- **The route tree is generated + gitignored.** After moving/adding route files, `vite build` regenerates
  `src/routeTree.gen.ts` — until then `<Link to="/x">` / `redirect({to:"/x"})` won't typecheck. Build, then typecheck.
- **Local D1 "table already exists":** `rm -rf apps/web/.wrangler/state`, then re-apply migrations.
- `pnpm dev` (root) runs Vite + workerd in one port. `pnpm deploy` / `pnpm deploy:staging` build + deploy
  (staging needs BOTH `CLOUDFLARE_ENV=staging` at build AND `--env staging` at deploy — the script does both).

## Architecture — the layered `src/worker` tree

**The file tree IS the architecture** (read the skill's `project-structure.md`). Organized BY LAYER, not by
concept; a feature is found by NAME across the layers.

```
apps/web/
  migrations/                 wrangler-native D1 migrations (0001_better_auth from the BA CLI + hand-written domain SQL)
  src/
    server.ts                 entry: MAX_REQUEST_BYTES guard → serveBackend(req,env) ?? SPA assets
    worker/                   ── THE BACKEND (Effect) ──
      handler.ts              serveBackend: /api/auth/* → Better Auth (+ login rate-limit); the public
                              prefixes (/api/setup, /api/password-links) → publicHandler; else /api/* → handler
      app.ts                  getApp/getAuth: build the app + Better Auth ONCE per isolate (bindings are stable)
      runtime.ts              assembleHandler: wires controllers + middleware + the request data layer into
                              TWO web handlers — `handler` (authed `api`) + `publicHandler` (unauth `publicApi`)
      env.ts  config.ts       Bindings (generated Env + secrets) · environmentOf (fail-closed) · tunables
      contract/               ── BROWSER-SAFE ── the typed route table (HttpApiGroup/Endpoint); nests by route.
                              api.ts (authed, .middleware(Authentication)) + public-api.ts (unauth) +
                              middleware/{authentication,meal-scoped,host-only}.ts (declarations)
      models/                 ── BROWSER-SAFE ── Model.Class shapes, the single source of truth; flat by concept
      views/                  ── BROWSER-SAFE ── response schemas + serializers (plain JSON) + derive.ts (Mifflin, browser-safe)
      db/                     ── server ── one repo per table (Command/makeTable) + sql.ts + table.ts
      domain/                 ── server ── the AGGREGATE per concept (+ a concern subfolder, e.g. domain/meal/estimatable/, domain/user/{snapshots,weights,members})
      controllers/ middleware/ support/  ── server ── thin handlers · scoping/auth gates · small combinators
      auth/                   ── server ── Better Auth instance (Kysely-D1 + KV) + permissions (ac/roles)
      blobs/                  ── server ── the R2 blob seam (the AI vision call lives in domain/meal/estimatable/, not here — ADR 0017)
    client/                   browser transport: api-client.ts (getClient + getPublicClient + run), auth-client.ts, gate.ts, me.ts, setup.ts
    routes/                   ── THE FRONTEND ── TanStack file routes (index, meals/$id, onboarding, profile, progress, admin, setup, set-password, login, how-it-works)
    components/ lib/          shared UI (bottom-nav, day-summary-panel, log-weight-sheet, meal-card) · cn() · date/units
                              (the SVG charts are route-co-located under routes/progress/-components/)
  test/                       in-process request tests over real local D1 + KV (miniflare); support/harness.ts
  auth.cli.ts                 GENERATION-ONLY Better Auth config (mirrors instance.ts plugins) → migrations/0001_better_auth.sql
```

**Browser-safe set is exactly `worker/{contract, models, views}`** — the frontend's only window into the
backend (the typed client derives from `contract`). The split tsconfig enforces it: server-only `worker/*`
can't compile under the frontend's DOM scope. (The old ADR 0005 "isomorphism" eslint rule is gone — the
boundary is now structural.)

### The two-API split (a Sufra decision the skill doesn't cover — recorded in refactor-plan.md Slice 4)

The api-wide `Authentication` middleware means every endpoint on `api` needs a session. The **unauth
bootstrap** — Setup (runs before any Host) + Password-link redemption (the token IS the credential) — can't
sit there. So there are **two `HttpApi`s**: `contract/api.ts` (authed) and `contract/public-api.ts` (no
middleware), built as two separate `toWebHandler`s in `runtime.ts` and dispatched by path prefix in
`handler.ts`. The frontend reaches the public one via a second typed client, `getPublicClient`.

## Auth model (ADR 0010)

- **Identity vs person.** Better Auth's credential table is renamed **`identities`** (`username`, `role`,
  `banned`); the app owns a separate **`users`** person/aggregate-root table sharing the SAME primary key
  (the universal `userId` anchor). `role`/`username` live on `identities`, read live via an inline-projection
  JOIN, never mirrored onto `users`. Provisioned by a `user.create.after` hook (`INSERT OR IGNORE`).
- **`CurrentUser = { id, username, role }`**, provided by the `Authentication` middleware. Roles: **`host`
  | `member`** (the schema value is `member`, not `user`).
- **No email.** Username + password; `<username>@sufra.local` satisfies BA's email column. `minPasswordLength: 6`.
- **Authorization is uniform 404 scoping (ADR 0013) — no 403 anywhere.** Ownership scoping (`WHERE userId =
  CurrentUser.id`, the `<Resource>Scoped` middleware) AND the role gate (`HostOnly`, a pure gate over
  `role === "host"`) both 404 on a miss. A non-host gets the same 404 a non-owner gets.
- **Build-once per isolate**, cached at module scope (env bindings are stable). The role-flip at Setup, the
  password set at redeem, and the credential delete at member-removal use `auth.$context.internalAdapter`
  (no admin session needed). Member provisioning uses `signUpEmail` with an unreachable placeholder password.
- **Password link (ADR 0016)** is an app-domain aggregate (`domain/password-link.ts`: issue / show / redeem),
  NOT part of the (delivery-free) Better Auth instance — the Host hands the link over out of band.

## Meals lifecycle — synchronous; Estimate as an append-only child (ADR 0017); two creation doors (ADR 0019)

No background analysis, no async `pending`. Client POSTs a base64 photo **and/or a `userText` description
(at least one — ADR 0019)** → `Meal.create` validates the image when present, inserts the meal row +
attaches the photo, THEN appends the first **Estimate** (a child row): `ok`, or `failed` (no analysis, an
error code) the Member retries against the stored source. So the meal persists even when the AI fails (the
retry state) — create is synchronous (the spinner is the UX) but NOT atomic-gated, and always returns 201 +
the meal (the failure is `latestStatus`/`latestErrorCode` in the view, not an HTTP error). **The userText
rides the first Estimate row's `refinement_text`** (CONTEXT "User text" — no `description` column, the Meal
keeps one shape); a photo-less re-run is text-only against the latest attempt's text (a bare retry re-runs
the description). A Meal has MANY Estimates over time; the **current** one is the latest `ok`. Totals are
**override-first, computed at read** from the current Estimate (`override.field ?? sum(foods[i].field)`), never
stored (ADR 0003). Override (PUT/DELETE), the Estimate sub-resource (`POST /meals/:id/estimates` — text ⇒
Refinement, none ⇒ retry; appends, never replaces), and the photo (`POST /meals/:id/photo` — add/replace,
NEVER re-estimates) are distinct reified sub-resources (ADR 0012/0017/0019). Views carry an additive
`hasPhoto?` (absent = old backend = true); `photoUrl` stays non-nullable (an old client's list decode must
survive text Meals).

## Project-specific decisions worth knowing (extend / deviate from the skill)

- **One source-aware English system prompt** in the prod path (`getSystemPrompt(locale, source)` in
  `estimatable/vision.ts` — `source: "photo" | "text"` swaps only the framing + notAnalyzable wording, the
  photo assembly byte-identical to the eval-pinned prompt); locale plumbing exists but is exercised by evals
  only. `callVisionModel` is shared by prod + evals (no drift).
- **`Analysis` is ONE Effect Schema** (`models/estimate.ts`, browser-safe — a DETAIL of the Estimate, not a
  peer concept) driving three consumers: `estimatable/vision.ts` derives its provider JSON Schema from it AND
  decodes output back through it; the `Estimate` row stores it as a JSON-TEXT column; the views derive Totals.
  No top-level totals — per-food values only. `notAnalyzable` is *content* (a successful "not food" verdict),
  distinct from a `failed` Estimate (the call broke).
- **`inference_runs` is a decoupled cost ledger** (no FK; soft `userId` + `estimateId`), SLIMMED to the
  durable money fact (ADR 0017 — the rich per-attempt facts live on the `estimates` row). The cost survives
  meal/Member/Estimate deletion. The Admin cost view sums it per UTC range ÷ the **Member count** (Host-excluding).
- **Vision model selection** lives in `app_settings` (the Admin model-select writes it; the estimatable concern
  reads `Settings.visionModelId()` → `resolveVisionModel`, which falls back to the default if a stored id goes
  stale). The catalog (allowed values + pricing) is a detail of the setting, in `views/setting.ts`
  (`VISION_MODELS`/`computeCost`) — browser-safe, NOT `models/`. The OpenRouter key is a `wrangler secret`,
  NOT in the admin UI.
- **Profile is an append-only `profile_snapshots` log** (ADR 0001) — "onboarded" = "has ≥1 snapshot" (no
  column). Derived values (Maintenance/Target/macros) are computed at read by `views/derive.ts` (browser-safe,
  shared by the worker AND the SPA). Edits take effect **next local midnight** (today's plan is sealed —
  ADR 0002); Day-segmentation is purely client-side by the Member's TZ.
- **Weights are user-correctable** (delete-only, ADR 0007); logging is one atomic dual-append (a `weights`
  row + a tomorrow `profile_snapshots` row). `calorie-history` is a derived **read-model** (no aggregate),
  TZ-bucketing meal Totals into local days with the historical Target attached.
- **Member-delete cascade is explicit** (D1 has no FK cascade): purge photos, delete the credential FIRST
  (so a partial failure never leaves a sign-in-able orphan), then the app rows in one `atomically` batch.
- **Charts are hand-rolled SVG, not Recharts** (PWA bundle size): the Day Summary ring, the Progress weight
  chart / calorie bars / BMI strip.

## Mobile (`apps/mobile`) — the second client of the same Worker

An Expo SDK 56 / RN 0.85 **dev-build** app (`expo-dev-client`, NOT Expo Go — NativeWind/`react-native-css`
and the Expo modules are native code). **Expo HAS CHANGED:** read the versioned docs at
https://docs.expo.dev/versions/v56.0.0/ before writing any code.

- **Conventions live in the skill — `references/frontend-expo.md`, read IN FULL** before touching the
  app: `src/app/` is the ROUTE TABLE only (thin re-exports; `_layout.tsx` files are real — the gate, the
  tab config); screens live in `src/screens/` — FLAT, one DOTTED folder per screen
  (`screens/(app).index/`), genuine logical units extracted into colocated kind-files; cookie-replay auth
  (`expoClient` + `usernameClient`, scheme `sufra`; no `adminClient` — authz is 404 scoping, ADR 0013);
  RN primitives + NativeWind v5 preview, deliberately narrow (only `src/global.css` compiles through
  `react-native-css`, via `metro-css-transformer.js`; `className` never reaches `SafeAreaView`).
  **`@expo/ui` is OUT while alpha** — spiked at SDK 56, failed cross-platform verification (the
  decision record + re-spike protocol: skill's `frontend-expo.md` §`@expo/ui`). Native feel rides
  `NativeTabs`/`Alert`/`RefreshControl` + the inline-commit OptionSheet for single-tap fields.
- **Arabic + RTL (ADR 0020):** strings ride **Lingui v6** (`<Trans>`/`` t`...` `` macros — NEVER at module
  scope; catalogs in `src/locales/{en,ar}/messages.po`, compiled `.ts` committed). After touching copy:
  `pnpm run i18n:extract`, translate the new `ar` entries, `pnpm run i18n:compile` (`--strict` fails on
  missing translations — the enforcement). **Lingui's CLI silently no-ops on Node < 22.19** (guarded by
  `import.meta.main`). The Locale is CLIENT state (`lib/locale.ts`, device default + the Profile Language
  row); direction is BOOT state (`lib/rtl.ts` imported FIRST in the root layout + `extra.supportsRTL`;
  switch = persist + flags + reload). Charts stay LTR; Western digits everywhere (`ar-u-nu-latn` via
  `lib/date.ts displayLocale()` — never `toLocaleString(undefined…)`); `DisplayText` drops its tracking
  under Arabic. The full convention: the skill's `frontend-expo.md` §RTL.
- **Server counterpart already in place** (apps/web `auth/instance.ts`): the `expo()` plugin +
  `"sufra://"` in `trustedOrigins` — device sign-in 403s without them.
- **The native client is backend-agnostic (ADR 0018):** v1 is free + bring-your-own backend — the server
  origin is USER STATE (a first-run Connect screen → probe via the public setup-status endpoint → store in
  SecureStore), not a build-time constant; `EXPO_PUBLIC_API_URL` is just the dev prefill. Wire changes to
  `worker/{contract,models,views}` stay ADDITIVE (the store app drifts against self-hosted backends).
- **Dev loop:** `cd apps/web && pnpm dev` (:5173), then `cd apps/mobile && pnpm android` / `pnpm ios`.
  Simulator/emulator reach the API at `localhost:5173` directly. **Physical Android over USB:**
  `adb reverse tcp:8081 tcp:8081 && adb reverse tcp:5173 tcp:5173` (Metro + API — no tunnel, no env
  change). **Untethered / physical iOS:** cloudflared quick tunnel; set the `https` origin in BOTH
  `apps/web/.dev.vars` (`BETTER_AUTH_URL`) and `apps/mobile/.env` (`EXPO_PUBLIC_API_URL`), restart both
  (`EXPO_PUBLIC_*` is inlined at bundle time — `expo start -c`).
- `pnpm android` exits right after install when another Metro already owns :8081 ("Skipping dev
  server") — that's its normal reuse behavior, not a crash.
- After touching Metro/NativeWind config: verify with `expo export --dev --platform android --clear`
  (a production export misses the dev-only LogBox CSS path). After `app.json` native changes:
  re-`prebuild`; never hand-edit `ios/`/`android/`.

## Gotchas (Effect 4-beta + the platform)

- **Training data is mostly Effect 3 / older AI SDK and will be WRONG.** Verify against `node_modules`.
  `docs/effect-gotchas.md` pins the VERIFIED facts (Schema `Literals`/`Finite`/`Trim`/`isBetween`,
  `HttpApi` query/params/payload keys, a handler may return a raw `HttpServerResponse`,
  `HttpServerResponse.fromWeb` for Set-Cookie, `auth.$context.internalAdapter`, the gate/cache
  `refetchType: "all"` rule, etc.).
- **`noUncheckedIndexedAccess` is on** in both tsconfigs — a `arr[0]` / destructure is `T | undefined`.
- **D1 has no interactive transactions** — atomicity is `atomically([...commands])` (one `batch()`); D1 has
  no FK cascade — cascades are explicit multi-command writes in the domain.
- **The Write/Edit tools want a fresh Read of a file in the same turn before editing** (esp. just-`git mv`'d
  files). Re-read right before editing.
- **Sharp:** deliberately NOT in `pnpm.onlyBuiltDependencies` (its install script breaks on Homebrew libvips);
  the prebuilt `@img/sharp-<platform>` optional dep is what runs. The "ignored build scripts: sharp" message
  is the expected working state.

## Status

- **Effect + Cloudflare re-platform — COMPLETE through Slice 5.** All five vertical slices landed on
  `refactor/effect-cloudflare-rebuild`: auth foundation, the Meal vertical, Member (profile/weights/`/me`),
  Admin + Setup + PasswordLink, and Progress + cleanup. The old `apps/web/worker/` (Hono/Drizzle) is deleted;
  `apps/evals` is repointed to the new vision call. Per-slice decisions are in `docs/refactor-plan.md`.
- **Estimate reified as an append-only child (ADR 0017).** The `estimator/` subsystem is dissolved into the
  Meal domain (`domain/meal/estimatable/`); the Estimate is the `estimates` child log (current = latest ok),
  failures persist for retry, the cost ledger is slimmed, and the vision-model catalog moved to
  `views/setting.ts`. The convention is in the skill's `references/third-party-apis.md`. Full verify green
  (worker + frontend + evals tsc · lint · 48 tests · build).
- **Cutover — DONE (2026-06-12).** Both Workers live on the new stack: prod `sufra` at
  **`https://lean-sufra.fawwaz.dev`** (the app origin — `sufra.fawwaz.dev` is the marketing site, a
  separate deployment) and `sufra-staging` on workers.dev. Real KV ids in `wrangler.jsonc`, per-Worker
  secrets set, D1 reset to the fresh migration baseline (no data migration; the pre-cutover dump is
  backed up locally outside the repo).
- **Mobile (Expo) client — core flows COMPLETE.** `apps/mobile`: the four-tier root gate (Connect →
  sign-in → Onboarding → the (app) tabs), the Today vertical (photo → Estimate → Day summary), the
  Meal detail formSheet (foods, Override editor, Improve — text ⇒ Refinement, none ⇒ retry — and delete;
  mounted in the ROOT stacks, not the tab group — NativeTabs only navigates declared triggers),
  Saved Meals (the Save toggle on the detail; the section lists the SHARED MealCard — `src/components/`;
  From-saved on Today clones into the selected Day, ADR 0008), the
  Onboarding wizard (the web wizard on RN primitives — pure-JS goal slider, three-field birthday), and
  Profile — the tab formerly named Settings, renamed for web parity — (per-field edit sheets appending
  a snapshot effective tomorrow; Log Weight from the Weight row — ADR 0007's dual-append, live Target
  preview via the shared derive; the Saved Meals section; sign-out; Change server), and
  Progress (a third tab — Today / Progress / Profile, web parity; the web's hand-rolled charts
  ported onto `react-native-svg`: the Weight line chart — tap a dot ⇒ native Alert ⇒ delete, ADR
  0007 — the server-colored calorie bars, the BMI strip as plain percent-positioned Views;
  `screens/(app).progress/helpers.ts` keeps the `['weights', p]` / `['calorie-history', p]` query-key
  shapes LogWeightSheet invalidates), and Admin (NOT a tab — the approved tab order stays Today /
  Progress / Profile; a Host-only row in Profile's Account section pushes the root-mounted
  `screens/admin/` — the meal-detail precedent; the row is UX only, the real gate is the server's
  404 scoping, ADR 0013. Cost card, vision-model select, Members add/link/delete; the native share
  sheet replaces the web's clipboard for the Password-link handover, the URL targeting the connected
  server origin per ADR 0018) —
  cookie-replay auth, NativeWind v5 preview, the route-table/`screens/` split per the skill's
  `frontend-expo.md`. The Connect tier implements ADR 0018 (origin in SecureStore, probed via the
  public setup-status endpoint; `EXPO_PUBLIC_API_URL` is the dev prefill). The template Explore tab is
  gone. Profile is RN with the inline-commit OptionSheet for single-tap fields (the @expo/ui spike
  was reverted after failing the iPad test — see the skill's decision record). Nothing is web-only.
- **Arabic + RTL (ADR 0020) — DONE end-to-end on mobile + the AI.** The Locale rides the Estimate-creating
  request (`locale?: string` on `POST /meals` + `POST /meals/:id/estimates`, allowlisted via `LOCALE_NAMES`,
  unknown → English, never stored — old backends strip it, verified `onExcessProperty: "ignore"`); all ~213
  mobile strings in Lingui catalogs with a complete Arabic translation; RTL boots from the stored Locale;
  the Language row restarts the app; history is history (Improve converts a Meal on demand). Evals cover the
  text source (all dishes) + Arabic photo/hints/text cases. Web SPA stays English by design.
- **Meal-creation entry redesign (ADR 0019) — backend + mobile DONE; web UI catch-up PENDING.** Today
  has three visible doors: Photo (native action sheet folds the library in) · Describe (textarea sheet →
  `POST /meals { userText }`) · From saved. Photo-less Meals render the basket placeholder (list) / the
  Add-photo target (detail); photo Meals get a corner Edit chip — both `POST /meals/:id/photo`, never
  re-estimating. Against an old backend the Describe path maps the 400 to "update your deployment" (no
  capability probe). **The web Today still has the old two-button entry and no Describe — the
  nothing-is-mobile-only parity invariant is deliberately broken until the web catches up.**

## Pointers

- House style: `~/.claude/skills/fawwaz-coding-style/` · Glossary: `CONTEXT.md` · Product: `PRD.md`
- ADRs: `docs/adr/0001–0019` · Re-platform plan + per-slice decisions: `docs/refactor-plan.md`
- Better Auth: https://www.better-auth.com/docs · TanStack Router: https://tanstack.com/router/latest
- Cloudflare Vite plugin: https://developers.cloudflare.com/workers/vite-plugin/
