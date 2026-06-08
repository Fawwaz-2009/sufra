-- profile_snapshots — the Member's append-only Profile history (CONTEXT "Profile snapshot"; ADR 0001),
-- renamed from the old `profile_log` per ADR 0011. Each row is a complete, immutable snapshot of the
-- plan inputs keyed by `effectiveFrom` (the Member's local date); the CURRENT profile is the latest row
-- by `effectiveFrom`. There is no separate current-state table, and Maintenance / Target / macro grams
-- are DERIVED at read, never stored (ADR 0003).
--
-- An "edit" is an APPEND, never a mutation; onboarding writes effective_from = today, edits write
-- tomorrow (today's plan stays sealed — ADR 0002). camelCase quoted columns + ISO TEXT dates, matching
-- the ProfileSnapshot model. `userId` is a plain FK with NO constraint (inline-join approach). heightCm
-- is integer; the kg fields are real; the enums are stored as TEXT.
CREATE TABLE profile_snapshots (
  "id"                text not null primary key,
  "userId"            text not null,        -- FK to users(id), NO constraint
  "effectiveFrom"     text not null,        -- YYYY-MM-DD, the Member's local TZ
  "sex"               text not null,        -- 'male' | 'female'
  "birthday"          text not null,        -- YYYY-MM-DD
  "heightCm"          integer not null,
  "displayHeightUnit" text not null,        -- 'cm' | 'imperial'
  "weightKg"          real not null,
  "displayWeightUnit" text not null,        -- 'kg' | 'lb'
  "activityLevel"     text not null,        -- 'sedentary' | 'light' | 'moderate' | 'active'
  "goalWeightKg"      real not null,
  "weeklyRateKg"      real not null,
  "createdAt"         text not null
);
-- "edited twice the same day" → both writes target the same (userId, effectiveFrom) row; the repo's
-- ON CONFLICT DO UPDATE overwrites it in place (ADR 0002).
CREATE UNIQUE INDEX "profile_snapshots_user_effective_idx" ON profile_snapshots ("userId", "effectiveFrom");
