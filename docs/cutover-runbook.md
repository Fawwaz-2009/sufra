# Cutover runbook — Effect + Cloudflare re-platform → `main`

The re-platform is **code-complete** on `refactor/effect-cloudflare-rebuild` (Slices 1–5; ADR 0009–0016).
This is the **ops cutover** — it needs your Cloudflare account + secrets and **nukes the prod/staging D1**
(no data migration; the cutover criterion is feature parity, not preserving rows). Run it yourself; nothing
here is automated by an agent. All commands run from `apps/web` unless noted.

> The strategy (ADR 0009 / refactor-plan.md): no backward compat, fresh migration baseline
> (`0001_better_auth.sql` from the BA CLI + clean domain migrations 0002–0009), deploy on a clean prod DB
> at parity, then flip to `main`.

## 0. Pre-flight (on the branch, already green)

```
cd apps/web
pnpm exec tsc -p tsconfig.worker.json && pnpm exec tsc -p tsconfig.json   # both clean
pnpm exec vitest run                                                       # 47 green
pnpm run lint && pnpm exec vite build                                      # clean
```

## 1. Create the KV namespaces + paste real ids into `wrangler.jsonc`

`wrangler.jsonc` currently has **PLACEHOLDER** KV ids (prod + `env.staging`). KV holds Better Auth sessions
(ADR 0010) — the Worker won't authenticate without a real namespace.

```
wrangler kv namespace create SUFRA_KV              # prints an id → paste into kv_namespaces[0].id (prod)
wrangler kv namespace create SUFRA_KV_STAGING      # prints an id → paste into env.staging.kv_namespaces[0].id
```

Replace `PLACEHOLDER_CREATE_KV_NAMESPACE` and `PLACEHOLDER_CREATE_STAGING_KV_NAMESPACE` in
`apps/web/wrangler.jsonc`, then `pnpm cf-typegen` (regen `worker-configuration.d.ts`) and re-typecheck.

(The D1 `database_id`s and R2 buckets are already real in `wrangler.jsonc`; LOGIN_RATE_LIMITER is declared.)

## 2. Set per-env secrets (separate writes per Worker)

```
# prod (Worker: sufra)
wrangler secret put BETTER_AUTH_SECRET            # openssl rand -base64 32
wrangler secret put BETTER_AUTH_URL               # the deployed origin, e.g. https://lean-sufra.fawwaz.dev
wrangler secret put OPENROUTER_API_KEY            # sk-or-v1-...

# staging (Worker: sufra-staging) — secrets are per-Worker
wrangler secret put BETTER_AUTH_SECRET --env staging
wrangler secret put BETTER_AUTH_URL --env staging   # https://sufra-staging.fawwaz-dev.workers.dev
wrangler secret put OPENROUTER_API_KEY --env staging
```

`BETTER_AUTH_URL` MUST equal the origin the browser uses (trustedOrigins / CSRF), or sign-in fails in the
browser while passing curl.

## 3. Nuke + migrate the D1 (fresh baseline — no data migration)

The existing prod/staging D1s hold the OLD Drizzle schema. The new migration set assumes a clean DB. Reset
each, then apply the new migrations. The cleanest reset is to **recreate** the D1 (new `database_id` → paste
into `wrangler.jsonc`), OR drop every table in place. Then:

```
wrangler d1 migrations apply DB --remote                 # prod  (0001_better_auth … 0009_password_links)
wrangler d1 migrations apply DB --remote --env staging   # staging
```

If you recreate the databases, update the `database_id`s in `wrangler.jsonc` first and `pnpm cf-typegen`.

## 4. Deploy both Workers

```
pnpm run deploy           # build + migrate --remote + wrangler deploy → sufra (prod)
pnpm run deploy:staging   # CLOUDFLARE_ENV=staging build + migrate --remote --env staging + deploy --env staging → sufra-staging
```

`deploy:staging` sets BOTH `CLOUDFLARE_ENV=staging` (build-time, flattens the env into the redirected
config) AND `--env staging` (deploy-time). Both are required — `--env staging` alone silently deploys to prod.

## 5. Smoke-test parity, then flip to `main`

On the deployed origin (and staging):
1. Visit the app on a clean DB → it routes to **`/setup`** (zero Hosts). Create the first Host (family name
   → username + password). You're signed in (the Set-Cookie round-trip).
2. **Onboard** (the Host eats too): sex/birthday/height/weight/activity/goal → the Day view + the derived Target.
3. **Log a meal** (photo → real Estimate via OpenRouter), check the detail/override/refine, the Day summary.
4. **/admin**: add a Member → copy the Password link → open `/set-password/:token` in a private window →
   set a password → sign in as the Member. Check the model-select + cost card. Delete a Member.
5. **/progress**: log a couple of weights + meals → the weight chart (tap-a-dot delete), calorie bars, BMI.

When parity holds:

```
cd <repo root>
git checkout main && git merge --no-ff refactor/effect-cloudflare-rebuild
git push origin main
```

## 6. Post-cutover

- Delete the agent memory `project_sufra_replatform` (the re-platform is done; the memory said "underway").
- The old `worker/` is already deleted on the branch; nothing to clean post-merge.
- Optional: prune the stale pre-refactor handoff docs (`docs/refactor-handoff.md`, `-2.md`, `-3.md`) once
  `main` is the new baseline — `refactor-plan.md` + the ADRs + CLAUDE.md are the durable record.

_No secrets in this repo. `apps/web/.dev.vars` (gitignored) holds local secrets; the request-test
`BETTER_AUTH_SECRET` is a throwaway._
