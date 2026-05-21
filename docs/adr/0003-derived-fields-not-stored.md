# Derived fields are computed at read time, not denormalized into the schema

Three derived fields previously lived as columns: `meal.kcal_total`, `user_profile.maintenance_kcal`, `user_profile.target_kcal`. All three are removed. Canonical sources stay where they belong — per-food JSON inside `meal.ai_analysis` and `meal.override` for meal totals, and the input fields on `profile_log` for Maintenance and Target. Derivation lives in two shared modules: `worker/meals/totals.ts` (resolves `override.field ?? sum(foods.field)` per meal) and `worker/profile/derive.ts` (Mifflin BMR × activity multiplier → Maintenance → Target).

## Why

Every denormalized column has a write-time bookkeeping cost: `create`, `setOverride`, `refine`, and every Profile edit had to recompute the cached value or it drifts silently. The household-scale workload doesn't justify it — Day Summary aggregates 3–5 meals at a time, single-user reads, no cross-user analytics. Application-layer derivation puts the formula in one place and removes the entire class of "the cache doesn't match the source" bugs.

## Considered alternatives

- **Denormalize macros too (mirror `kcal_total` for protein/carbs/fat).** Rejected — multiplies write-time bookkeeping by 4 with no perf payoff at v1 scale. Future v2 fiber/sugar fields would further compound the pattern.
- **Keep `kcal_total` as the one denormalized exception** (for week-strip range aggregates). Rejected for symmetry — if the principle is "compute at read," carve-outs invite drift later. The week strip's red/yellow/green status is computed client-side from the same `/api/meals` response that powers the meals list and Day Summary; no extra round trip.

## Consequences

- `/api/meals` response includes resolved `kcal`, `proteinG`, `carbsG`, `fatG` per meal — computed in `meals.list()` by `worker/meals/totals.ts`.
- Week strip status (green/yellow/red) computes client-side from the per-meal kcal in the response, summed per day. No `SELECT SUM(kcal_total)` query path remains.
- The Day Summary panel and the week strip use the same data shape — one `/api/meals?from&to` round trip serves both.
- The Mifflin formula lives in exactly one file (`worker/profile/derive.ts`), imported by both the worker (server-side reads for Day Summary's Target) and the SPA (in-sheet live preview when editing inputs).
- Any future move toward denormalization needs to be driven by *measured* read-path pressure, not assumed perf.
