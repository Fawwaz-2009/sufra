-- weights — the Member's measurement records (CONTEXT "Weight"; ADR 0007), renamed from the old
-- `weight_log` per ADR 0011. Logging a Weight is one atomic dual-append (this row + a
-- `profile_snapshots` row effective tomorrow). A Weight is user-CORRECTABLE: it can be deleted from the
-- Progress chart, and that delete never touches `profile_snapshots` — sealed plans don't move (ADR 0007).
--
-- camelCase quoted columns + ISO TEXT timestamps, matching the Weight model. `userId` is a plain FK with
-- NO constraint (inline-join approach). `loggedAt` is the measurement instant (chart x-axis + range
-- filter); `createdAt` is the audit stamp. The id is a text UUID (every app table; the old autoincrement
-- integer id is gone).
CREATE TABLE weights (
  "id"        text not null primary key,
  "userId"    text not null,        -- FK to users(id), NO constraint
  "weightKg"  real not null,
  "loggedAt"  text not null,        -- UTC ISO Z; the measurement instant
  "createdAt" text not null
);
-- The Progress chart read: a Member's weights in a logged-at range.
CREATE INDEX "weights_user_logged_idx" ON weights ("userId", "loggedAt");
