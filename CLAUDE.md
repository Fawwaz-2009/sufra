# Sufra — Agent Orientation

Two docs anchor this codebase:

- **`CONTEXT.md`** — domain glossary. Canonical terms (Meal, Estimate, Override, Refinement, Total, Confidence, Clarification, Day, Target, Host, Member, …). Read first whenever you're about to name something or describe a concept in code or docs.
- **`PRD.md`** — product decisions, milestones, positioning, architecture intent, open questions in §10. Read before any non-trivial change.

This file is the short orientation; the others are the long-form. **Use the vocabulary in CONTEXT.md exactly in code, comments, commit messages, and PRs.** "Estimate" not "analysis." "Member" not "end user" in product copy (schema still says `user` — see Pending renames below).

## What this is

A photo-first calorie tracker for households. **Host-deployed** on the Host's own Cloudflare account, **host-paid inference**, multi-user (Host provisions accounts for Members). PWA, English + Arabic, Middle Eastern cuisine as a first-class citizen.

## Stack

- **Frontend:** Vite + React 19 + TanStack Router (file-based, loader + `useSuspenseQuery`) + TanStack Query + Tailwind v4 + shadcn
- **Backend:** Hono on Cloudflare Workers, single Worker serving SPA assets and `/api/*`
- **Database:** Cloudflare D1 via Drizzle ORM
- **Storage:** Cloudflare R2 (binding `BUCKET`), accessed via authenticated Worker routes — no S3 presigned URLs
- **Auth:** better-auth with `username` + `admin` plugins; no email anywhere
- **PWA:** vite-plugin-pwa with workbox (autoUpdate; `/api/*` is NetworkOnly)
- **Inference:** OpenRouter, called via `estimateMeal(env, photo, opts)` in `worker/meals/estimator/`
- **Dev:** `@cloudflare/vite-plugin` runs Worker inside `vite dev` against workerd

## Run it

```
pnpm dev                    # vite + workerd, one port
pnpm typecheck              # tsc -b across app + worker + node projects
pnpm build                  # tsc -b && vite build
pnpm lint
pnpm db:generate            # drizzle-kit generate (after schema changes)
pnpm db:migrate:local       # wrangler d1 migrations apply DB --local
pnpm db:migrate:remote      # wrangler d1 migrations apply DB --remote
pnpm cf-typegen             # regen worker-configuration.d.ts after wrangler.jsonc edits
pnpm deploy                 # build + wrangler deploy

cd evals && pnpm eval               # full matrix via custom EstimatorProvider (uses the same code path as prod)
```

## Project layout

```
worker/                       # Cloudflare Worker (Hono + better-auth + Drizzle)
  index.ts                    # Hono routes; exports AppType for Hono RPC.
                              # Protected meal routes sit behind a middleware that
                              # attaches session to c.var. Handlers are thin —
                              # parse → call meals module → format response.
  auth/
    index.ts                  # createAuth(env) — better-auth instance per request
    permissions.ts            # access controller, host + user roles
  db/
    index.ts                  # createDb(env.DB) Drizzle factory
    schema.ts                 # all tables (auth-managed + our domain)
    migrations/               # generated SQL, committed
  meals/                      # Meals domain module — fat module, Rails-style.
    index.ts                  # barrel: re-exports operations + estimator
    operations.ts             # createMealsModule(env) factory. Domain ops:
                              # list, get, streamPhoto, create, setOverride, refine.
                              # Owns all D1 + R2 access for meals. Sync create flow
                              # (no DB write until estimator succeeds).
    estimator/                # The AI module — pure function, no env coupling beyond OPENROUTER_API_KEY.
      index.ts                # estimateMeal(env, photo, opts) — entry point + re-exports
      schema.ts               # MealAnalysis Zod schema. NO top-level totals;
                              # foods array is the source for kcal/macros.
      prompts.ts              # One English system prompt + dynamic locale instruction
                              # via getSystemPrompt(locale). LOCALE_NAMES map drives
                              # additional languages — no per-language prompt files.
      models.ts               # MODELS list, DEFAULT_VISION_MODEL_ID, computeCost()
      errors.ts               # VisionError + MAX_IMAGE_BYTES (4MB defensive cap)
src/                          # React SPA
  routes/                     # file-based; routeTree.gen.ts is generated, gitignored
    __root.tsx                # auth/setup fetch happens here; results in context
    index.tsx                 # Day view. Loader-based with useSuspenseQuery —
                              # no isLoading branches in component bodies.
                              # pendingComponent + errorComponent at route level.
    meals.$id.tsx             # Meal detail + Override editor + Refine section.
                              # notFoundComponent via throw notFound() in loader.
    setup.tsx, login.tsx
  components/
    meal-card.tsx             # MealCard — uses /api/meals/:id/photo proxy route
  lib/
    api.ts                    # Hono RPC client (hc<AppType>)
    auth-client.ts            # better-auth React client
    query-client.ts
    date.ts                   # todayRangeUtc() — client-side day bucketing
evals/                        # promptfoo eval harness
  estimator-provider.ts       # Custom ApiProvider — calls estimateMeal() directly.
                              # Eval shares the prod code path; no response_format
                              # divergence, no thinking-mode JSON leaks.
  promptfooconfig.ts          # MODELS-driven provider matrix
  smoke.ts                    # `pnpm smoke <model>` — single call, no full matrix
  dishes.ts, scorers/, fixtures/
CONTEXT.md                    # Domain glossary — canonical terminology
PRD.md                        # Product source of truth + open questions (§10)
wrangler.jsonc                # bindings: DB, BUCKET, ASSETS
worker-configuration.d.ts     # generated by `wrangler types`, committed
.dev.vars                     # local secrets (gitignored); .dev.vars.example checked in
```

## Auth model

- **One auth instance per request** — `createAuth(c.env)` inside the route handler (or middleware). Don't try to memoize it at module scope (env isn't available there).
- **No email anywhere.** better-auth requires the `email` column on `user`, so we store `<username>@sufra.local` (non-routable). Sign-in by username only.
- **No public signup.** `disabledPaths: ["/sign-up/email"]` blocks the HTTP route. Internal `auth.api.signUpEmail()` still works — used by the setup wizard. Members are created via the admin plugin's `auth.api.createUser()`.
- **Roles:** schema enum is `host | user`. CONTEXT.md canonicalized **Host** and **Member**, but the schema rename is still pending (see "Pending renames" below).
- **First deploy (Setup):** `POST /api/setup` only works while zero hosts exist. Creates the host, signs them in, inits `app_settings` singleton.
- **Protected routes:** `/api/meals/*` are covered by a Hono middleware that extracts session and 401s if missing. Handlers read `c.var.session.user.id` — no per-handler auth check duplication.
- **Onboarding** (per-account profile + Target): not yet built. Universal across Host + Member.

## Meals lifecycle

The meal flow is **synchronous and atomic**. No background analysis, no `pending`/`failed` status:

1. Client POSTs a multipart photo.
2. Worker calls `meals.create()` which calls `estimateMeal(env, photo)`.
3. **Only if the estimator succeeds**: photo goes to R2 + meal row is inserted with the analysis attached.
4. **If the estimator throws** (network, rate limit, schema parse fail): nothing persists; the route returns an error; the client shows a toast.

Consequences:
- The `meal` table has no `analysis_status` column. A row exists ⟺ it has a valid Estimate. `ai_analysis` and `kcal_total` are NOT NULL.
- The "loading" UX lives on the client (button spinner during the 3–5s estimator call), not in the DB.
- No `ctx.waitUntil`, no polling, no pulsing pending cards.

## Conventions

- **Comments:** default to none. Only write a comment when the *why* is non-obvious (hidden constraint, surprising workaround). Never restate what the code does. Never reference PRD sections, milestones, or "current fix" in comments — that belongs in commit messages / PR descriptions.
- **File org:** in route files, main component first; helpers, skeletons, utilities below. Don't lead with helpers — the reader wants to see the route.
- **Type safety:** use the Hono RPC client (`api.api.*.$get()`/`$post()`) for our own routes, not raw `fetch`. Use the `authClient` for `/api/auth/*` routes.
- **Inferred types over hand-written ones:** for modules exposing a factory + operations, return type comes from `ReturnType<typeof create…>` — don't author parallel interface declarations that have to be kept in sync.
- **Validation:** zod v4 + `standardSchemaResolver` (from `@hookform/resolvers/standard-schema`). The older `zodResolver` is pinned to zod 3 internals and breaks.
- **No `archive` table for users.** Cascade deletes on `user_profile` and `weight_log`. Soft-disable is via the admin plugin's `banned` flag.

## Deviations from PRD worth knowing about

These have been incorporated into PRD.md but are easy to miss:

- **OpenRouter API key** is **not** in the admin UI. It's a Cloudflare secret (`wrangler secret put OPENROUTER_API_KEY`). Model *selection* is in `app_settings`.
- **No forced password change** on first login. Member signs in with whatever password the Host set; they can change it from Profile later.
- **Auth** is better-auth, not the "rolled, argon2id" plan in §8.1 — uses scrypt via Web Crypto (no WASM).
- **R2 access is via authenticated Worker routes**, not S3 presigned URLs. The PRD's "signed URLs" language is a security stance (no public bucket exposure) which the proxy approach satisfies without S3 signing infrastructure.
- **`captured_at` stored as UTC ISO Z**, not offset-bearing ISO. Per CONTEXT.md "Day": Day-segmentation is purely client-side based on the Member's current TZ.
- **No top-level macros in `MealAnalysis`.** Totals are computed via `override.field ?? sum(foods[i].field)`. `meal.kcal_total` is the denormalized cache of that resolution.
- **Override and Refinement are distinct correction paths** (CONTEXT.md). Override = manual totals correction, AI untouched. Refinement = user text → re-run AI → replace the Estimate (no history kept). Open UX gap: PRD §10 #10 + #11 — the override-vs-AI collision isn't surfaced in the UI; the Confidence chip currently shows without its clarification surface.
- **`keyNutrients` deferred to v2.** Fiber / sugar / sat fat / sodium dropped from the v1 schema; calorie + macros are the v1 focus. **The day-view mockup shows these — when implementing the Day summary panel, skip the key-nutrients card.**
- **Translation deferred to v2.** v1 ships English-only. Schema columns `userProfile.language`, `userProfile.numeralSystem`, `app_settings.default_language` are dead in v1, retained for v2. Logical CSS properties (`ms-*`, `me-*`, `text-start`) are still used everywhere so v2 RTL is a stylesheet flip.
- **Setup wizard collects family name.** `app_settings.family_name` (required, default 'My' for backfill). Displayed as "the {family_name} Sufra" on the Password link page. Editable in Admin.
- **Password link flow** replaces the temp-password handoff. One mechanism for both invite + reset. `password_link` table — opaque base64url token, 24h TTL, UNIQUE on userId (regenerate replaces in place), cascade on user delete. Single endpoint `/api/set-password/:token` (unauth, token IS the credential). Password set uses `auth.$context.password.hash()` + `internalAdapter.updatePassword()` to bypass the admin-middleware requirement on `setUserPassword`.
- **inference_run audit log is decoupled.** No FK to meal, soft `userId` text column with no FK. Cost survives meal/Member deletion. The Admin cost view sums this table per UTC range.
- **No top-level totals in `MealAnalysis`.** Schema has per-food values only; totals computed via override-first resolution.
- **Saved meals: explicit match only.** The AI never sees saved meals. Defer to M5.
- **One English system prompt** (hardcoded `locale: "en"` in the prod call path). Plumbing for other locales exists, exercised by evals only.
- **The eval harness shares the prod code path.** `evals/estimator-provider.ts` is a promptfoo `ApiProvider` that calls `estimateMeal()` directly. Same prompts, same schema, same response handling.

## Critical wrangler.jsonc bits

- `not_found_handling: "single-page-application"` — assets layer serves `index.html` for unknown paths (SPA routing).
- `run_worker_first: ["/api/*"]` — **required for production**. Without this, the assets layer would intercept API routes via SPA fallback. Dev works without it because the Vite plugin always routes through the Worker.
- `migrations_dir: "./worker/db/migrations"` on the DB binding.

## Local secrets (.dev.vars)

```
BETTER_AUTH_SECRET="<openssl rand -base64 32>"
BETTER_AUTH_URL="http://localhost:5173"
OPENROUTER_API_KEY="sk-or-v1-..."
```

In production, set the OpenRouter key via `wrangler secret put OPENROUTER_API_KEY` and `BETTER_AUTH_URL` to the deployed origin via `wrangler secret put BETTER_AUTH_URL`. Without `BETTER_AUTH_URL`, better-auth logs a `Base URL could not be determined` WARN on every request — functionally OK for cookie sessions but noisy.

## Pending renames / migrations

These are decisions that landed in CONTEXT.md or PRD but haven't been swept through the code yet:

- **`user` → `member` for the non-host role.** Schema enum, better-auth `defaultRole`, all PRD/code uses. CONTEXT.md uses **Member** as canonical. Pending; small migration + sweep.
- The current schema retains `role: ["host", "user"]`. better-auth doesn't fight the rename — `roles: { ... }` keys are arbitrary strings.
- **Dead language columns** (`app_settings.default_language`). Drizzle-kit's interactive-rename-detection blocks dropping these in a non-TTY shell; live with them for v1, sweep in a dedicated migration when v2 starts populating them.
- **Drizzle meta snapshot resync was handled via 0008 no-op.** The 0007 migration was hand-rolled because drizzle-kit's interactive rename-detection blocks in non-TTY shells (see ADR 0001/0003). To get the snapshot back in sync without re-applying 0007's work, we ran `pnpm db:generate` (picking "+ create" on every rename prompt — drizzle-kit's heuristic will incorrectly propose renames like `target_kcal → goal_weight_kg` or `user_profile → profile_log`, which are NOT renames), then replaced the generated `0008_lucky_ozymandias.sql` with a `SELECT 1;` no-op so the migration runner records it as applied without re-doing 0007's drops/creates. **If you make further schema changes, run `db:generate` normally — diffs are now against the 0008 snapshot, which reflects the real state.**

## Open product questions

See PRD §10. Specifically active before further UX work:
- **#10 + #11** — Override-vs-Refinement collision and Confidence-chip-without-clarifications. Both bit dogfooding; either fix or suppress before M4.
- **#12** — Failed-meal remediation. The current synchronous create flow makes failed rows impossible, so this is partly self-resolved; but failures *during the call* still need a good client-side affordance (toast + retry button on the spinner).

## Gotchas hit during setup

- D1 + Drizzle "boolean" mode emits `DEFAULT true/false` in SQL; SQLite accepts it. Don't try to "fix" the migration file.
- ESLint may flag stale "unused import" diagnostics between two sequential Edit calls in the same file. Re-run `pnpm lint` to confirm; the file itself is usually fine.
- Drizzle-generated migrations that recreate a table to change NOT NULL constraints need manual review — if the source table has rows with NULL in the now-NOT-NULL column, the INSERT SELECT fails. Add a `WHERE` filter or `DELETE` in the migration.
- `worker-configuration.d.ts` is committed (it's huge but stable). Regenerate via `pnpm cf-typegen` whenever `wrangler.jsonc` bindings change.
- `pnpm` overrides force `sharp@^0.34.5` to avoid the duplicate libvips dylib warning from `@vite-pwa/assets-generator`.
- The shadcn `form` component silently no-ops in v4.7; use react-hook-form + bare Input/Label.
- Promptfoo requires Node 22.22+; `.nvmrc` is pinned. Use `nvm use` before running evals.

## Status

- **M1** (deploy skeleton, setup wizard, login) — landed; setup is now a **2-step wizard** (family name → account)
- **PWA foundation** (manifest, SW, placeholder icons) — landed; real icon art pending Replicate token
- **AI evaluation harness** — landed. `evals/` runs the production estimator via a custom promptfoo provider. Findings (under the old code path): Gemini 3 Flash leads at ~78% kcal bare / ~96% kcal with pre-baked portion hints; portion is the dominant error source. Gemini 3.5 Flash newly available — eval pending. See `evals/RESULTS.md`.
- **M3 (meal capture, detail, override, refinement)** — **landed**. Synchronous create; estimator-as-function; loader-based routing with `useSuspenseQuery`; auth middleware; thin handlers; meals module owns D1 + R2.
- **Admin view (cost + model select + Members)** — landed. `/admin` route, bottom nav, inference_run audit log decoupled from meals/users, Password link flow for Member provisioning + password reset (unified). Sonner toasts, AlertDialog for delete-and-destroy. Translation cut from v1 (English-only).
- **M2 (onboarding + Profile + Day summary)** — **landed**. The shape that shipped diverges from the design images and from the original PRD chip-based goal selection; the architectural decisions are captured in three ADRs:
  - `profile_log` is the single source of truth for Member inputs — append-only history, no parallel `user_profile` table. Derived values (Maintenance, Target, macro grams) computed at read by `worker/profile/derive.ts`. See **ADR 0001** + **ADR 0003**.
  - Profile edits take effect *starting next local midnight* — today's plan is sealed from the moment the day begins. Onboarding is the only Profile write that applies same-day. See **ADR 0002**. This rule applies uniformly to weight changes (Profile edit OR future dedicated weight-log surface).
  - Goal selection is a **slider** for `goal_weight_kg` + rate chips (Slowly 0.25 / Moderately 0.5 kg/wk). The directional `goal: lose|maintain|gain` enum was dropped — direction is derived from `sign(goal_weight − weight)`. The 4-chip approach in the original PRD was replaced because the chip labels ("Lose moderately") are less concrete than picking an actual goal weight.
  - Slider range is asymmetric: current weight `−60 kg` to `+30 kg` (floored/capped at the schema's 30/300 absolute bounds). Lose more, gain less.
  - Sex enum collapsed to `male | female` (no `unspecified`/"Other"). Mifflin's gendered constants don't have a neutral middle; the UI keeps it as a pragmatic two-choice question without elaborating "assigned at birth" — the ⓘ → /how-it-works carries the explanation.
  - `/how-it-works` is auth-optional and listed in the root onboarding-gate exclude list so the wizard's ⓘ links can deep-link into it.

- **Progress tab (M5/M6 weight + intake)** — **landed**. `/progress` route co-located per ADR 0006. Weight chart is custom SVG (no Recharts) — raw `weight_log` points with tap-a-dot delete (see **ADR 0007** — `weight_log` rows are user-correctable, `profile_log` rows remain sealed). Calorie history is server-aggregated via `GET /api/calorie-history?from&to&bucket&tz` returning per-bucket avg kcal + historical Target via `snapshotFor` + color (green/yellow/red against historical per-day Target — same thresholds as the Day view's week strip). BMI card uses universal WHO bands with height-personalized kg axis. Bottom nav went 3 → 4 tabs (Today / Progress / Profile / Admin). Weight sheet promoted to `src/components/log-weight-sheet.tsx` and shared by Profile + Progress; `POST /api/weights` is the sole writer (`PATCH /api/profile` dropped `weightKg` handling). Maintenance refinement deferred to v1.5.

- **M5 Saved Meals — NEXT.** Design fully grilled, captured in **ADR 0008** + PRD §6.5 + CONTEXT.md "Saved Meal". Implementation is intentionally small: one schema column (`meal.saved_at`), three endpoints (`GET /api/meals/saved`, `PATCH /api/meals/:id/saved`, `POST /api/meals/clone`), bookmark glyph on MealCard + bookmark toggle in Meal detail header, inline "Add" control on the Day view (replaces the FAB; two options — photo / from-saved), Profile gets a Saved Meals section at the very end (reuses `<MealCard>`), Sign Out moves to Profile header top-right (PRD §6.11 was updated to reflect this — reasoning is the saved-meals list would otherwise push body-anchored Sign-Out off-screen). Custom names deferred to v2 — bookmark is a pure toggle.
  - **Critical for a fresh session:** there is **no separate `saved_meal` table**, no parallel edit surface, no naming sheet. The Saved Meal IS the source `meal` row; editing it goes through `/meals/:id`; re-logging clones in full (ai_analysis, override, and the R2 photo via server-side copy to a new key) so source + clone have independent lifecycles. Read ADR 0008 before touching anything in this area.

## M2 — what shipped (vs original design intent)

The wireframes that drove M2 deviated meaningfully from both the original design images and the early PRD chip-based goal model. The actual shape that landed:

**Onboarding (6 screens):**
1. Sex — **two** chips, Male / Female (no "Other" — Mifflin has no neutral constant, see Status notes)
2. Birthday — date input (`YYYY-MM-DD`); recompute age dynamically
3. Height — number + cm/ft+in toggle (canonical cm storage)
4. Weight — number + kg/lb toggle (canonical kg storage). Typing here auto-syncs `goalWeightKg` so the Member doesn't end up at a stale goal on step 6.
5. Activity level — four-option chips with inline definitions
6. Goal — **slider** (not chips) for `goal_weight_kg` from `currentWeight − 60` to `+30` kg; rate chips (Slowly / Moderately) below; derived target preview card. Hidden rate when slider sits on Maintain.

Progress dots (`●○○○○○`) on every screen. Back chevron on screens 2-6.

**Profile (single page):**
- ABOUT YOU: per-field bottom sheets (iOS-Settings pattern). Each row is a chevron → sheet → save → toast "Starts tomorrow." Sheets show in-sheet live preview using the shared formula module.
- GOAL: sheet with the slider + rate chips (mirrors onboarding step 6).
- YOUR NUMBERS (read-only): Daily target + macro grams. "Pending changes — starts tomorrow" pill when a not-yet-effective snapshot exists.
- ACCOUNT: username (read-only) + Sign out.

**Day summary panel** (between week strip and meals list):
- Left: kcal ring (custom SVG, no Recharts) — Remaining as default, tap-to-toggle to Consumed; preference in `sufra:ring-mode` localStorage.
- Right: three macro bars (P/C/F) — `eaten/goal` labels, CSS-only bars.
- ⓘ → `/how-it-works`. No key nutrients (deferred to v2 with the `MealAnalysis` schema extension).
- Past-day-aware: `snapshotFor(profiles, localDate(selectedDay))` picks the profile snapshot that was active on that day, then derives target/macros from it.

**`/how-it-works`**: static page with Mifflin formula + activity multipliers + macro split, each with citations.

## Critical design notes for the next session

These captured architectural decisions deviate from the original mockup images and the early PRD. A new agent without context will get them wrong:

- **No direct kcal target input.** Members pick a goal weight via slider; target is derived from `maintenance + sign(goalWeight − weight) × weeklyRate × 1100`. Never directly editable. Inputs flow one way into derived numbers. See ADR 0003.
- **No `user_profile` table.** It was replaced in M2 by an append-only `profile_log` (one row per onboarding + per Profile edit). The "current profile" = the row with the latest `effective_from`. See ADR 0001. Don't reintroduce `user_profile`.
- **Profile edits apply starting next local midnight.** Today's plan is sealed. This rule is uniform — applies to weight changes too, whether from Profile or from a future Progress-tab weight-log surface. See ADR 0002.
- **No macro customization in v1.** 25/50/25 (P/C/F) split is the v1 default, sourced from IOM AMDR. Per-macro overrides are v2 work governed by the "user intent is sacred" principle (PRD §10 #15).
- **No adaptive daily target.** Sufra ships a fixed daily target; smoothing / weekly banking / HealthKit activity adjustments are explicit-opt-in v2 features with full transparency (PRD §10 #16). Cal AI's silent target fluctuation is the anti-pattern.
- **No safety floor (deficit warning) in v1.** Members are adults; the math runs. Deferred to v1.5 — revisit if dogfooding surfaces members hitting a steep deficit unawares. See PRD §10 #6.
- **No manual deactivate of Members.** Delete-only with cascade. `inference_run` cost rows survive Member deletion (PRD §6.1 + the audit-log decoupling principle).
- **No `goal: lose|maintain|gain` enum.** Direction is derived from `sign(goal_weight_kg − weight_kg)`. The slider IS the input.
- **Birthday, not age.** Age is computed dynamically from the `birthday` column on `profile_log`. Mifflin's `−5·age` term re-runs every read.
- **Sex is `male | female` only.** No "Other" / `unspecified` — Mifflin's gendered constants don't have a neutral middle. UI keeps it minimal; ⓘ → `/how-it-works` carries the explanation.
- **Weight is stored as canonical kg (`real`), height as canonical cm (`integer`).** Display unit toggles live in `profile_log.display_height_unit` / `display_weight_unit`. Formula module never sees imperial.
- **Numeric inputs (weight, height-cm) keep a local string state.** Don't round-trip through the parent's `number` state on every keystroke — typing "93.5" loses its dot mid-keystroke. See `src/routes/profile.tsx` `WeightSheet` and `src/routes/onboarding.tsx` `StepWeight` for the pattern.
- **`/how-it-works` is in the onboarding-gate exclude list.** Both Profile and the wizard's ⓘ links deep-link into it. Back button uses `router.history.back()` so the destination depends on entry point.
- **Ring is a custom SVG, not Recharts.** One screen, one component, no library dependency. If M5/M6 brings Recharts in for trend charts via shadcn, the Day Summary ring can stay as-is.
- **"Inactive" badge from the admin mockup is not implemented** — no inactive state exists.
- **"Active sessions" from the admin mockup is not implemented** — out of v1 scope.
- **"Last login" / "Never signed in" labels from earlier admin drafts are not displayed** — minimum-UI principle.
- **Pending invite rows look identical to active Member rows.** No "Pending" pill, no expanded "Awaiting first sign-in" card. The 🔑 icon does the same action regardless of state (generate Password link).
- **The clipboard fallback** (`document.execCommand("copy")`) is intentionally retained alongside the modern `navigator.clipboard` API so dev-server-on-LAN-IP testing works. Don't strip it (see PRD §10 #17).
- **Charts are custom SVG, not Recharts.** Day Summary ring, Weight chart on Progress, Calories bars on Progress, BMI band strip — all hand-rolled. Recharts was deliberately not added (PWA bundle size). When building more charts, mirror the existing SVG pattern.
- **Saved Meals is a marker on `meal`, not a separate table.** `meal.saved_at` is the truth; no parallel CRUD; editing a saved Meal navigates to `/meals/:id`; re-logging clones via `POST /api/meals/clone` (copies row + R2 photo). Bookmark is a pure toggle — no naming sheet in v1, rename deferred to v2. See **ADR 0008** + PRD §6.5.
- **Day view FAB will be removed in M5.** Replaced by an inline "Add" control at the top of the meals list with two options: photo / from-saved. Inline position makes adding to past Days self-evident (it sits inside the list of the selected Day).
- **Sign Out lives in Profile's header top-right** (post-M5). The earlier PRD line ("nobody signs out daily, don't put it in chrome") was reversed because the growing Saved Meals list would push body-anchored Sign-Out off-screen. See PRD §6.11.

## Pointers

- PRD: `PRD.md`
- Glossary: `CONTEXT.md`
- Better-auth docs: https://www.better-auth.com/docs
- TanStack Router docs: https://tanstack.com/router/latest
- Cloudflare Vite plugin: https://developers.cloudflare.com/workers/vite-plugin/
