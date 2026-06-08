# Profile state lives in an append-only `profile_log`, not a current-state `user_profile` table

> **Evolved by ADR 0011.** The append-only-snapshots-plus-derive-at-read core is preserved; the table is renamed `profile_log → profile_snapshots` and the collection is folded into the one Member aggregate. Read this for the original rationale; ADR 0011 for the current shape.

A Member's profile inputs (sex, birthday, height, weight, activity level, goal weight, weekly rate) are stored as an append-only `profile_log` table. Each row is a full snapshot keyed by an `effective_from` local date. The Member's "current profile" is the latest row by `effective_from` — there is no separate `user_profile` table. Derived values (Maintenance, Target, Macro goals) are computed at read time via the shared formula module (`worker/profile/derive.ts`) and never stored.

## Why

Profile edits need history. Past days must show the Target the Member was under *at the time*, not retroactively reflect new edits (see ADR 0002). An append-only log is the natural shape; keeping a parallel `user_profile` cache reintroduces the sync problem we're already eliminating at the column layer by dropping `target_kcal` and `maintenance_kcal` (see ADR 0003).

## Considered alternatives

- **Keep `user_profile` as a denormalized cache of the latest `profile_log` row.** Rejected — same drift risk at the table layer that we're avoiding at the column layer.
- **Snapshot per-day via a `daily_target_log` populated on the first meal of each day.** Rejected — couples plan history to meal-logging behavior; profile changes are a first-class event regardless of whether the Member logged anything that day.

## Consequences

- "Current profile" reads: `SELECT * FROM profile_log WHERE user_id = ? AND effective_from <= today_local ORDER BY effective_from DESC LIMIT 1`. Index on `(user_id, effective_from DESC)` makes it O(log n).
- Every `PATCH /api/profile` inserts a new row, never `UPDATE`. Same for `POST /api/onboarding` (first row).
- The Onboarding gate becomes "session exists ∧ no `profile_log` row for this user" — same redirect semantics as the previous `user_profile`-row check.
- `user_profile.onboardedAt` is gone; if ever needed, it's derivable as `MIN(created_at)` from `profile_log`.
