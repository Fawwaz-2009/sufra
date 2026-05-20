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
- **`keyNutrients` deferred to v2.** Fiber / sugar / sat fat / sodium dropped from the v1 schema; calorie + macros are the v1 focus. **The day-view mockup shows these — revisit before implementing the summary header.**
- **Saved meals: explicit match only.** The AI never sees saved meals. Defer to M5.
- **One English system prompt for all locales.** `getSystemPrompt(locale)` appends a short locale instruction telling the model to output user-read fields in the target language. Adding a new language = one line in `LOCALE_NAMES`.
- **The eval harness shares the prod code path.** `evals/estimator-provider.ts` is a promptfoo `ApiProvider` that calls `estimateMeal()` directly. Same prompts, same schema, same response handling. No `response_format` divergence to debug when models behave differently (the Gemini 3.5 thinking-mode leak that bit us is now impossible).

## Critical wrangler.jsonc bits

- `not_found_handling: "single-page-application"` — assets layer serves `index.html` for unknown paths (SPA routing).
- `run_worker_first: ["/api/*"]` — **required for production**. Without this, the assets layer would intercept API routes via SPA fallback. Dev works without it because the Vite plugin always routes through the Worker.
- `migrations_dir: "./worker/db/migrations"` on the DB binding.

## Local secrets (.dev.vars)

```
BETTER_AUTH_SECRET="<openssl rand -base64 32>"
OPENROUTER_API_KEY="sk-or-v1-..."
```

In production, set the OpenRouter key via `wrangler secret put OPENROUTER_API_KEY`.

## Pending renames

These are decisions that landed in CONTEXT.md or PRD §10 but haven't been swept through the code yet:

- **`user` → `member` for the non-host role.** Schema enum, better-auth `defaultRole`, all PRD/code uses. CONTEXT.md uses **Member** as canonical. Pending; small migration + sweep.
- The current schema retains `role: ["host", "user"]`. better-auth doesn't fight the rename — `roles: { ... }` keys are arbitrary strings.

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

- **M1** (deploy skeleton, setup wizard, login) — landed
- **PWA foundation** (manifest, SW, placeholder icons) — landed; real icon art pending Replicate token
- **AI evaluation harness** — landed. `evals/` runs the production estimator via a custom promptfoo provider. Findings (under the old code path): Gemini 3 Flash leads at ~78% kcal bare / ~96% kcal with pre-baked portion hints; portion is the dominant error source. Gemini 3.5 Flash newly available — eval pending. See `evals/RESULTS.md`.
- **M3 (meal capture, detail, override, refinement)** — **landed**. Synchronous create; estimator-as-function; loader-based routing with `useSuspenseQuery`; auth middleware; thin handlers; meals module owns D1 + R2.
- **M2 (onboarding + Target)** — **deferred** (we built M3 first because the photo loop was the higher-risk thing to prove out). Hardcoded `locale: "en"` in the estimator until the profile language lands.
- **Next: Day-navigation header + summary panel** (see mockup + handoff doc). Touches: a day strip with prev/next, behavior shift for "log a meal on a past day," macro targets, possibly key nutrients (currently deferred per above — revisit).

## Pointers

- PRD: `PRD.md`
- Glossary: `CONTEXT.md`
- Better-auth docs: https://www.better-auth.com/docs
- TanStack Router docs: https://tanstack.com/router/latest
- Cloudflare Vite plugin: https://developers.cloudflare.com/workers/vite-plugin/
