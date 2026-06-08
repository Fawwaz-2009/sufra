# One Member aggregate owns profile_snapshots + weights; calorie-history is a read-model

The three former modules — profile, weights, and calorie-history — collapse into one `Member` domain aggregate, rooted at the `users` person row (ADR 0010). The Member owns two append-only collections — `profile_snapshots` (renamed from `profile_log`) and `weights` (renamed from `weight_log`) — exposed as `Member.snapshots.*` and `Member.weights.*`. The "effective-tomorrow seal + merge-from-latest + upsert-the-pending-snapshot" rule (ADR 0002) lives in exactly one place: the aggregate. Logging a Weight is one atomic dual-append — `atomically([weight, profile_snapshot])` — closing the partial-failure window between the two tables. `calorie-history` is not an aggregate; it is a read-model — a derived rollup over meals + `profile_snapshots`.

REST stays split along two axes, with no `PATCH /profile`:

- `POST /profile-snapshots` (top-level, user-scoped, **create only**). First create = onboarding: applies same-day and seeds the first Weight. Subsequent creates = effective-tomorrow upsert of the pending snapshot. The collection is **sealed** — no update, no delete.
- `/weights` — `GET` / `POST` / `DELETE /weights/:id`.
- `GET /me` — the account singleton. Reads the resolved current snapshot plus derived Target / Maintenance / macro grams. It never writes a snapshot.
- `GET /calorie-history` — the read-model report.

Onboarding is the first `POST /profile-snapshots`; there is no separate onboarding endpoint.

## Why

The three modules shared one table while duplicating the seal rule twice and mapping the snapshot seam three times. The weight dual-write already spans two tables — a Weight log must append both a `weights` row and a `profile_snapshots` row — so it has a real consistency boundary that wants one owner. One consistency boundary means one aggregate.

The Member (the person, the `users` root from ADR 0010) is the natural owner: snapshots and weights are owned collections in the Rails `has_many` sense, with no lifecycle of their own. They cascade with the account and have no meaning apart from it.

calorie-history performs no writes — it is a derived rollup, so it is a read-model, not an aggregate. Modeling it as a peer module gave it the shape of something that owns state when it owns nothing.

An "edit" to a Profile is an **append** of a new immutable snapshot, never a mutation of an existing one (ADR 0001, ADR 0003). That is why there is no `PATCH /profile`: it would be the only verb in the app that lies about what it does. The table is renamed `profile_log → profile_snapshots` so the schema matches the canonical noun "Profile snapshot."

## Layer placement

- `domain/member.ts` — the aggregate root over `users`; composes the `snapshots` and `weights` concerns; owns the seal rule and the atomic dual-append.
- `db/profile-snapshots.ts`, `db/weights.ts` — Command repos (flat, plural).
- `models/profile-snapshot.ts`, `models/weight.ts` — `Model.Class` definitions.
- `views/me/`, `views/calorie-history/` — serializers (browser-safe). The calorie-history read-model keeps `snapshotFor` + `deriveProfile` on the read/view side; both stay browser-safe so the SPA can derive locally.
- `controllers/profile-snapshots.ts`, `controllers/weights.ts`, `controllers/me.ts`, `controllers/calorie-history.ts` — thin → `Member.*` / the read-model.

## Considered alternatives

- **Keep three peer modules (profile, weights, calorie-history).** Rejected — the seal rule is duplicated twice, the snapshot seam is mapped three times, and the weight dual-write has no atomicity.
- **A separate Plan aggregate distinct from Member.** Rejected — the plan has no independent lifecycle; it cascades with the account, and the seal is a Member invariant, not a Plan one.
- **`PATCH /profile` singleton edit.** Rejected — edits are appends of immutable snapshots, not in-place mutations; the verb would lie.
- **A dedicated onboarding endpoint.** Rejected — onboarding is the first `POST /profile-snapshots` with server-applied first-time rules (same-day, seed the first Weight); a second endpoint would duplicate the create path.

## Consequences

- One place owns the effective-tomorrow seal; logging a Weight is atomic; the partial-failure window between `weights` and `profile_snapshots` is closed.
- `profile_log` is renamed `profile_snapshots`; `weight_log` is exposed as the `weights` collection.
- calorie-history moves to the read/view side as a read-model, keeping `snapshotFor` + `deriveProfile` (browser-safe).
- **Evolves ADR 0001** — append-only profile history and derive-at-read are preserved; the table is renamed and the collection is folded into the Member aggregate.
- **Preserves ADR 0002** (the seal rule, now owned in one place), **ADR 0003** (Target / Maintenance / macros derived at read), and **ADR 0007** (weights remain user-correctable).
