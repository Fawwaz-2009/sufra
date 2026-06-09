# Estimate as an append-only child of Meal; the AI seam lives in the domain

Reify the **Estimate** as its own append-only child table (`estimates`), one Meal → many Estimates over
time, the current Estimate being the latest row with `status = "ok"`. Create makes the first; each
Refinement or retry **appends** another. A failed attempt is a persisted `failed` row (analysis null,
`errorCode` set) — so the AI failing is **data**, not an HTTP error, and the Member can retry against the
same stored photo. Dissolve the `estimator/` subsystem: the humble OpenRouter call moves **into the Meal
domain** as the `estimatable` concern (`domain/meal/estimatable/`), and the env-swapped Effect service
shrinks to a stub seam (`Vision`) whose only job is testability. The vision-model catalog (curated code,
not a table) moves to the browser-safe `views/setting.ts` as the allowed values + pricing for the
`visionModelId` setting. The decoupled cost ledger (`inference_runs`) is kept but slimmed to the durable
money fact; the rich per-attempt facts live on the `estimates` row.

## Why

The pre-existing design (ADR 0009 + the "synchronous-atomic, no status" rule) made the Estimate a column
on the meal (`ai_analysis`), overwritten in place by Refinement, with failures discarded — a meal row
existed **iff** the AI had succeeded. That foreclosed three things the product wants: **persisted failed
attempts** (so a Member can retry a meal whose photo the AI couldn't read, surviving a reload), **Estimate
history** (refinements no longer destroy the prior Estimate), and a **clean cost trail per attempt**. The
append-only child is the same shape `profile_snapshots` already uses (ADR 0001): an immutable log where
"current = latest". It makes the Meal aggregate **richer** and, in doing so, demotes the third-party
integration from a five-file subsystem to a function the domain calls — the Rails instinct that an external
API is an implementation detail of the domain, never the architecture.

The second motivation is convention. `estimator/` had grown a "fat transport": the layer owned cost math,
error→message copy, usage extraction, and the schema drift-net alongside the actual call. That violated the
pattern `mail.md`/`media.md` already embody (humble transport; the domain owns orchestration and typed
outcomes; views own presentation). This ADR realigns the estimator to that pattern and the house style
records it generally in `references/third-party-apis.md`.

## What changed

- **`models/estimate.ts`** — the `Estimate` `Model.Class` (`mealId` soft FK, `status`, `analysis`
  JSON-TEXT/None-on-failure, `refinementText`, `errorCode`, `modelId`, tokens, latency) **plus** the
  `Analysis` schema (the content it carries — a *detail* of the Estimate, exported for the vision call +
  evals, not a peer concept). `models/meal.ts` drops `aiAnalysis` + `lastRefinementText`; `MealOverride`
  moves onto the Meal (it persists across Estimates).
- **`db/estimates.ts`** — `create` (append), `currentForMeal` (latest ok), `deleteForMeal` (the app-level
  cascade — D1 has no FK cascade). The meal reads (`db/meals.ts`) JOIN the current analysis + latest
  attempt status onto each meal, decoding into `views/meal.ts`'s `MealRow`.
- **`domain/meal/estimatable/`** — `vision.ts` (the humble, Effect-free OpenRouter call + prompts + the
  derived JSON Schema, shared verbatim with `apps/evals`), `service.ts` (the `Vision` stub seam:
  `VisionLive`/`VisionTest`/`VisionLayer(env)`), `index.ts` (the concern: pick model → Vision → append the
  Estimate row + the ledger; never throws). The Meal aggregate calls it from create / reestimate / clone.
- **Reified resource** — `POST /meals/:id/estimates` (optional `userText`: none = retry, present =
  Refinement) replaces the singular `POST /meals/:id/refinement`. `EstimateFailed` (the 502) is deleted;
  create always returns 201 + the meal, the failure carried as `latestStatus`/`latestErrorCode` in the view.
- **`inference_runs`** — slimmed to `{ id, userId?, estimateId?, modelId, kind, costUsd, createdAt }`;
  decoupled (no FK), recorded only when the call billed. The cost view (`projections/cost.ts`) is unchanged.

## Considered alternatives

- **Keep the Estimate as a meal column, add retry another way.** Rejected — a retryable failed attempt has
  to be persisted *somewhere*; a child row is the honest model and unlocks history + per-attempt cost for free.
- **Merge `inference_runs` into `estimates`.** Tempting now that the estimate is a record, but the ledger
  must survive meal/Member deletion (the Host paid OpenRouter regardless; member-removal must not erase
  spend). Two lifecycles → two tables; the small field overlap is the price of a self-standing ledger.
- **Make the vision-model catalog a table (Ruby's `AiModel`).** Rejected — the list is developer-curated and
  tied 1:1 to eval results; a table would duplicate it into data and add CRUD nobody wants. A read-time
  stale-id fallback (`resolveVisionModel`) gives the FK-like integrity without the table.
- **Keep `estimator/` as its own subsystem.** Rejected — vision-estimation is not Sufra's product surface;
  the domain (Meal) is. The call belongs in the domain; only the test stub survives as a seam.

## Consequences

- **Supersedes the "synchronous-atomic / no status / row exists ⟺ valid Estimate" rule** (CONTEXT "Meal",
  "Analysis Status"): a meal can now exist with only a failed Estimate (the retry state). Create is still
  synchronous (the Member waits; the spinner is the UX) — what changed is that the failure persists.
- **Supersedes the in-place-Refinement rule** (CONTEXT "Refinement"): Refinement appends; the prior Estimate
  is kept as history. "Exactly one Estimate" becomes "exactly one *current* Estimate (latest ok)".
- **Partially supersedes ADR 0009**: the AI leaf is still an env-swapped Effect service, but it is no longer
  a top-level subsystem and no longer owns cost/copy/catalog — it is the `Vision` stub inside the Meal domain.
- `notAnalyzable` is unchanged — it is *content* (a successful call's "this isn't food" verdict), distinct
  from a `failed` Estimate (the call itself broke).
- The convention is recorded in `~/.claude/skills/fawwaz-coding-style/references/third-party-apis.md`.
