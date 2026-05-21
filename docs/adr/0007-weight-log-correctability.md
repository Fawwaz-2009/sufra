# `weight_log` rows are user-correctable; `profile_log` rows remain sealed

A Member can delete a `weight_log` row from the Progress tab's Weight chart (tap-a-dot → Delete this weight → `DELETE /api/weights/:id`). The delete affects only `weight_log`; it never touches `profile_log`. Past-day Day Summaries continue to read the historical `profile_log` snapshot they always did — including snapshots whose `weightKg` was driven by the now-deleted measurement.

## Why

Every weight-write does a dual insert: a `weight_log` row (measurement record, feeds the Progress chart) and a `profile_log` row with `effective_from = tomorrow_local` (plan input, feeds Target derivation via `snapshotFor`). The two tables hold the same value but serve different purposes and have different correctness properties:

- `weight_log` is a measurement. A measurement can be wrong (typo, mis-read scale) and the Member should be able to fix their own record.
- `profile_log` is a plan input. Once `effective_from <= today_local`, the plan is sealed (ADR 0002) — the Member ate against the Target it produced, and rewriting history would erase a real fact.

Letting users delete `weight_log` rows is the simplest affordance that respects both properties at once: the chart cleans up; sealed plans don't move.

The common-case correction loop also keeps working without needing rollback logic. Member typos 82.9, realizes within seconds, logs 72.9 again — the second log's `ON CONFLICT (user_id, effective_from) UPDATE` (already in `worker/profile/operations.ts`) overwrites the bad pending `profile_log` row. By the time the Member opens the chart to clean up the wrong dot, the plan is already corrected. The chart delete is purely cosmetic.

## Considered alternatives

- **Delete + roll back the matching `profile_log` row when unsealed.** Rejected for v1 — the matching row isn't linked by FK, so we'd be inferring the link by `(userId, effective_from = tomorrow_of_weight_log, weightKg matches)`, which is brittle if the Member logged twice the same day with different values. The common case is already handled by the existing `ON CONFLICT UPDATE`; the remaining edge case doesn't justify a fragile join.
- **Edit-in-place on `weight_log` rows.** Rejected — opens the same `profile_log` rollback question without simplifying it. Members who want a different value can delete + re-log.
- **No correction affordance at all; live with wrong dots forever.** Rejected — the existing 30–300 kg schema bound catches catastrophic typos but not plausible-but-wrong values (82.9 vs 72.9). Members would see permanent wrong dots they can't fix without DB access.
- **Add explicit `profile_log_id` FK on `weight_log` to enable conditional cascade delete.** Deferred — useful if v2 wants automatic plan-rollback on delete (under the §10 #15 "user intent is sacred" intent), but unnecessary in v1.

## Consequences

- New endpoint: `DELETE /api/weights/:id`, scoped by `c.var.session.user.id`. Performs a single `DELETE` on `weight_log`; no other tables touched.
- ADR 0001 (`profile_log` append-only) is not relaxed by this change — `profile_log` writes still go through `insert` + `ON CONFLICT UPDATE` exclusively. The append-only guarantee is intact.
- ADR 0002 (today is sealed) is not relaxed — no `profile_log` row, sealed or unsealed, is mutated by this flow.
- ADR 0003 (derive at read) is not touched — Target derivation continues to read whichever `profile_log` snapshot was active for the queried day.
- **UX asymmetry to surface in `/how-it-works`:** deleting a 2-week-old typo dot fixes the chart but does *not* change the Day Summary for that 2-week-old day. The historical Target reflects what the Member was actually aiming at on that day, even if the input that produced it was wrong. One paragraph in the explainer is enough; no code workaround that respects ADR 0002 can hide this.
- The Profile's Weight sheet keeps existing as an entry point, but it shares its component and its endpoint (`POST /api/weights`) with Progress's Log Weight sheet — two surfaces, one implementation, identical write semantics. `PATCH /api/profile` stops handling the `weightKg` field; weight changes flow exclusively through `POST /api/weights`.
