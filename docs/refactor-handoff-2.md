# Sufra re-platform — handoff #2 (Slices 3–5 + frontend restore)

You are continuing the **in-progress re-platform** onto the **fawwaz-coding-style** (Effect v4 +
Cloudflare). **Slices 1 (auth) and 2 (meals) are DONE and verified.** This doc supersedes
`refactor-handoff.md` (which was written before Slice 2 and is now history). It tells you *what's done*,
*the patterns to mirror*, *what's left (Slices 3–5)*, and *the gotchas Slice 2 discovered* — read it
before touching anything.

Branch: **`refactor/effect-cloudflare-rebuild`** · Slice 1: **`0353d16`** · Slice 2: **`84831fd`**

---

## 0. Read these first (authoritative — don't re-derive)

1. **The skill** — `~/.claude/skills/fawwaz-coding-style/SKILL.md` + `references/*.md`. Read the relevant
   `references/<x>.md` IN FULL before building that layer. Conventions are settled — don't relitigate.
2. **ADRs 0009–0016** (`docs/adr/`) — every decision + its reasoning.
3. **`docs/refactor-plan.md`** — the slice plan; its **"Slice 2 — decisions landed"** section records what
   Slice 2 settled (estimator, MealAnalysis-unify + its risk, photo serve, AI-quota deferral, the frontend
   deferral). Keep adding a "Slice N — decisions landed" block per slice.
4. **CONTEXT.md** — domain glossary. Use the terms exactly.
5. **The two TEMPLATES you now mirror** (in this repo, not starting-fire): **Slice 1** (`/me` + auth) and
   **Slice 2** (the whole Meal vertical). Slice 2 is the richest worked example — aggregate + concerns,
   reified sub-resources, a side-effect service (the estimator), media, a binary endpoint, request tests,
   and the typed frontend seam. **Copy its patterns.** `starting-fire` is still the upstream gold standard
   for anything Slice 1/2 didn't exercise.

## 1. How to work (the loop)

Each slice is a **vertical**, built + verified before the next: `contract → models → db → domain
(aggregate + concerns) → views → controllers → middleware → frontend`.

```
cd apps/web
pnpm exec tsc -p tsconfig.worker.json && pnpm exec tsc -p tsconfig.json   # typecheck (worker + frontend)
pnpm exec vitest run                                                      # all tests (unit + request)
pnpm exec wrangler d1 migrations apply DB --local                         # apply migrations to local D1
pnpm run lint                                                             # eslint (worker + frontend)
pnpm exec vite build                                                      # regenerates routeTree.gen.ts + proves the build
pnpm exec wrangler types                                                  # regen worker-configuration.d.ts after wrangler.jsonc changes
```

- **Local D1 conflict** ("table already exists"): nuke it — `rm -rf apps/web/.wrangler/state`, then re-apply.
- **Commit per slice** (Slice 1 + 2 are the model commits). Verify typecheck + tests green first.
- **Definition of done (per slice):** both tsconfigs clean · request tests green · that slice's frontend
  reshaped (restored from `deferred-frontend/` + re-seamed) · lint clean · commit.

## 2. What's built (DON'T rebuild — copy the patterns)

### Slice 1 (auth) — `src/worker/`
Shell (`server.ts`, `worker/handler.ts` two-seam, `worker/app.ts` build-once + provision bridge,
`worker/runtime.ts` HttpApi assembly, `env.ts`, `config.ts`); persistence (`db/sql.ts`, `db/table.ts` —
`makeTable`); auth (`auth/instance.ts` Kysely-D1 + KV, `auth/permissions.ts` host/member);
authentication middleware; the `/me` vertical; the request-test harness (`test/support/*`, `signInAs`,
`cleanDb`).

### Slice 2 (meals) — the template for every aggregate
- **estimator/** — env-swapped Effect service: `estimator.ts` (tag + `EstimateFailure`/`EstimateResult`),
  `layers.ts` (`EstimatorLive` via OpenRouter/AI-SDK + deterministic `EstimatorTest` + `EstimatorLayer(env)`),
  `models.ts`, `prompts.ts`. Selected for `ENVIRONMENT="test"` so request tests never hit OpenRouter.
- **models/** — `meal.ts` (+ `Photo` slot, JSON-TEXT columns via `Schema.fromJsonString`),
  `meal-analysis.ts` (the ONE Effect Schema source of truth + the derived `MEAL_ANALYSIS_JSON_SCHEMA`),
  `attachment.ts`, `inference-run.ts`.
- **db/** — `meals.ts`, `attachments.ts`, `inference-runs.ts`; **blobs/** (`blobs.ts` tag + `layers.ts`
  R2-only, no presign — ADR 0014).
- **domain/** — `meal.ts` aggregate (index/show/create/refine/clone/destroy + the estimator+audit helper +
  the bound `Photo` slot), concerns `meal/{overridable,saveable}.ts` + shared `concerns/attachable.ts`
  (adapted: `attach`/`read`/`copy`/`purgeRecord`, no signing).
- **contract/** — `meals.ts` (+ `EstimateFailed` typed error + `MealScoped` decl in `middleware/`),
  `meals/{override,refinement,saved,clones,photo}.ts`, `upload.ts`.
- **views/** — `meal.ts` (`resolveTotals` override-first + non-effectful `photoUrl`).
- **controllers/** — `meals.ts` + `meals/{override,refinement,saved,clones,photo}.ts` (the photo one
  returns a raw `HttpServerResponse.uint8Array`). **middleware/** — `meal-scoped.ts`.
- **frontend** — `src/client/{api-client,auth-client}.ts` (typed seam, SPA-only); Day view +
  `meals/$id` reshaped to the typed client; per-route `authClient.getSession()` gate.
- **test/** — `test/worker/controllers/meals.request.test.ts` (11) + `test/worker/contract/upload.test.ts` (2).

## 3. Decisions already made (Slice 2 deltas — apply everywhere)

Beyond the handoff-#1 deltas (no email; SPA not Start; media proxy-serve; `User`/`users` code-name with
"Member" product noun; 404 everywhere no 403; `BUCKET`/`KV` bindings; plain-SQL migrations):

- **Unify domain shapes on ONE Effect Schema; derive JSON Schema from it** when a provider needs one
  (the MealAnalysis pattern). **Use `Schema.Finite`, not `Schema.Number`, for any numeric field that ends
  up in a provider JSON Schema** — plain `Number` emits an `anyOf` with `"NaN"`/`"Infinity"` string
  sentinels. Verify the derived schema is inline (no `$ref`/`$defs`) before trusting it.
- **Side-effects are env-swapped Effect services** (`Mailer`/`Estimator` shape): a `*Live` + a `*Test`
  capturing/deterministic layer + a `*Layer(env)` selector on `environmentOf(env)`. Only `test` swaps.
- **Audit/cost tables are decoupled** (no FK, soft `userId`); written by the aggregate around the effect,
  on success AND billed-failure.
- **Binary/odd responses:** a handler may return a raw `HttpServerResponse` instead of the success value
  — keep the endpoint in the contract (behind its scoping middleware), don't special-case the seam.
- **Frontend is reshaped per slice via the `deferred-frontend/` restore** (see §6).

## 4. The two worker folders + reference map

- **`apps/web/worker/`** (outside `src/`) — the OLD Hono + Drizzle backend. **Dead** (not in `wrangler.jsonc`,
  not built, eslint-ignored), retained as **port-reference**. `apps/evals` still imports its estimator.
  **Delete in Slice 5** (+ orphan `tsconfig.app.json`/`tsconfig.node.json`, + repoint evals, + update
  CLAUDE.md, which still documents this old layout).
- **`apps/web/src/worker/`** (inside `src/`) — the NEW Effect backend (ADR 0009). The live one.

Domain logic to PORT from the old `worker/` (read for exact behavior, reimplement in the new style):

| Slice | Old files to port |
|---|---|
| 3 (Member) | `worker/profile/{operations,schema}.ts` + `worker/profile/isomorphic/{derive,constants}.ts` (Mifflin, `deriveProfile`, `snapshotFor`); `worker/weights/operations.ts`; `worker/calorie-history/{operations,schema}.ts` |
| 4 (Admin) | `worker/routes/{setup,admin}.ts`; `worker/auth/password-link.ts`; `worker/auth/isomorphic/permissions.ts`; the `app_settings` + `inference_run` cost rollup |
| (schema shapes) | `worker/db/schema.ts` — the column shapes for `profile_log`→`profile_snapshots`, `weight_log`→`weights`, `app_settings`, `password_link` |

## 5. Remaining slices (endpoints/verbs/status are in ADR 0012 + the resource ADRs)

- **Slice 3 — Member (NEXT).** ADR 0011: fold profile + weights into ONE `Member` aggregate rooted on
  `users`. `POST /profile-snapshots` (first = onboarding same-day + seeds first weight; rest =
  effective-tomorrow upsert; sealed — no update/delete). `weights` (`GET`/`POST` atomic dual-append/`DELETE`).
  `GET /me` composes the resolved current snapshot + derived Target/Maintenance/macros (`deriveProfile` +
  `snapshotFor`, browser-safe). `GET /calorie-history` is a **read-model** (no aggregate). Migrations
  `0006_profile_snapshots.sql`, `0007_weights.sql`. Preserves ADR 0001/0002/0003/0007.
- **Slice 4 — Admin + Setup + PasswordLink.** ADR 0013/0016. Setup (`POST /api/setup`, **unauth** —
  restructure `contract/api.ts` to per-group `Authentication` or a 2nd unauth api; **figure the clean
  Effect-HttpApi way to set the session cookie from a handler and document it**). Host-only admin behind a
  `HostOnly` 404-gate; `PasswordLink` aggregate (issue/show/redeem); `app_settings` singleton (this is
  where the estimator's model selection finally comes from — Slice 2 defaulted to `DEFAULT_VISION_MODEL_ID`).
  Migrations `0008_app_settings.sql`, `0009_password_links.sql`.
- **Slice 5 — Progress + cleanup.** Progress read views (weight/BMI/calorie history). **Delete the old
  `worker/`** + orphan tsconfigs + **repoint `apps/evals`** to the new estimator (its single-source
  `MealAnalysis`). Update CLAUDE.md to the new architecture. Then the **cutover** (§7).

## 6. Frontend restore (the per-slice mechanic)

The not-yet-reshaped route trees live in **`apps/web/deferred-frontend/`** (outside the compiled `src/`),
moved there in Slice 2 so the build stays green with only the meal surface live. Per slice:

1. `git mv apps/web/deferred-frontend/routes/<x> apps/web/src/routes/<x>` (and any needed
   `deferred-frontend/components/*` back to `src/components/`).
2. Reshape its **data seam only** — the `-queries.ts` (loader reads) + the mutation hooks go from the old
   `@/lib/api` Hono-RPC / raw `fetch` to `run((await getClient()).<group>.<verb>(...))` (the typed client
   from `src/client/api-client.ts`). The presentational components are largely reusable.
3. **Auth gate:** Slice 2 left a per-route `authClient.getSession()` → redirect `/login`. When Slice 3/4
   land profiles + setup, restore the Setup + Onboarding gates (they were in the old `__root.tsx`
   beforeLoad; the Day-view summary panel + bottom-nav also return then).
4. After moving route files, **`pnpm exec vite build`** to regenerate `src/routeTree.gen.ts` (gitignored),
   then typecheck.

Slice 3 restores `profile` + `onboarding` (+ `day-summary-panel`, the goal slider, log-weight sheet);
Slice 4 restores `admin` + `setup` + `set-password` + `how-it-works`; Slice 5 restores `progress` + the
`bottom-nav` (now that all 4 tabs exist).

## 7. Gotchas — Effect 4-beta + AI-SDK API facts VERIFIED in Slice 2 (pinned; re-verify only on a bump)

Training data is mostly Effect 3 / older AI SDK and will be WRONG. These were checked against
`node_modules`:

- **Schema:** `Schema.Literals([...])` (enums), `Schema.Finite` (not `Number` for JSON-schema fields),
  `Schema.fromJsonString(schema)` (JSON-as-TEXT column codec; Encoded = string), `Schema.toJsonSchemaDocument(schema, { additionalProperties: false })` → `{ schema, definitions }` (draft-2020-12), `Schema.encodeSync`/`decodeUnknownSync`/`decodeUnknownEffect`. `Schema.toStandardSchemaV1` exists but is NOT a `StandardJSONSchemaV1`, so it can't go straight into AI-SDK `Output.object` — derive a JSON Schema instead.
- **Effect:** NO `Effect.tapBoth`, NO `Effect.catchAll`. Use `Effect.tap` + `Effect.tapError` + `Effect.matchEffect` + `Effect.catchTag`. `Option.fromNullishOr` (not `fromNullable`). Service tags are yielded directly (`const x = yield* SomeRepo`), no `.asEffect()`.
- **HttpApi (contract):** GET query params key is **`query`** (not `urlParams`). `HttpApiEndpoint.delete` exists. Binary success: `Schema.Uint8Array.pipe(HttpApiSchema.asUint8Array())`. A handler may **return an `HttpServerResponse`** (e.g. `HttpServerResponse.uint8Array(bytes, { contentType, headers })`) instead of the success value.
- **HttpApiClient (frontend):** request keys are **`params`** (path), **`query`** (query string), **`payload`** (body) — e.g. `client.meals.show({ params: { id } })`, `client.meals.index({ query: { from, to } })`. A scoped 404 fails with the typed `NotFound` → map it with `.pipe(Effect.catchTag("NotFound", () => Effect.succeed(null)))`.
- **Middleware path params:** `HttpRouter.schemaPathParams(Schema).pipe(Effect.orDie)` (a middleware can't read the handler's typed args). `orNotFound` lives in `support/http.ts`.
- **AI SDK v6** (`ai@6`, `@openrouter/ai-sdk-provider@2`): `import { Output, generateText, jsonSchema } from "ai"`; `generateText({ output: Output.object({ schema: jsonSchema(jsonSchema7) }), system, messages: [{ role:"user", content:[{type:"text",text},{type:"image",image: Uint8Array}] }] })`; read `result.output` (decode it yourself with the Effect schema) + `result.usage.{inputTokens,outputTokens}`. **Always load the `ai-sdk` skill + verify against `node_modules/ai/docs` before touching the estimator** (memory `feedback_ai_sdk_skill`).
- **eslint:** the config was stale for the new stack. There's now a `src/worker/**` override (allows the
  `Effect.Success<typeof make> {}` derived-interface, the `Command<any>` generic, `_options`), a
  `components/ui/**` react-refresh-off, and `worker/**` + `deferred-frontend/**` global ignores. Extend
  these, don't fight the rules — the house idioms are settled.
- **Harness quirk:** the Write/Edit tools require a fresh Read of a file IN THE SAME TURN before editing
  it, even if you read it earlier. Re-read right before editing.
- **EstimatorTest pattern:** the request pool's `OPENROUTER_API_KEY` is a placeholder; the deterministic
  `EstimatorTest` layer is what keeps meal-create tests off the network. Mirror it for any new side-effect.

## 8. Definition of done + cutover (after Slice 5)

- **Per slice:** both tsconfigs clean · request tests green · slice's frontend restored + re-seamed · lint
  clean · commit.
- **Cutover:** nuke prod + staging D1 (no data migration); `wrangler kv namespace create` (prod + staging)
  + paste real ids into `wrangler.jsonc` (currently PLACEHOLDERs); set secrets per env
  (`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `OPENROUTER_API_KEY`); apply migrations `--remote`; deploy
  (`deploy:staging` keeps the dual `CLOUDFLARE_ENV=staging` + `--env staging`). Update **CLAUDE.md** to the
  new architecture and **delete memory `project_sufra_replatform`**.

_No secrets here. The test `BETTER_AUTH_SECRET` in `vitest.request.config.ts` is a throwaway; real secrets
are `wrangler secret`s / `.dev.vars` (gitignored)._
