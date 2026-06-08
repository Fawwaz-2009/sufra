-- Meals — one captured photo + its Estimate, owned by a Member (CONTEXT "Meal").
--
-- Synchronous-atomic create: a row exists ⟺ the estimator succeeded, so `aiAnalysis` is NOT NULL and
-- there is no status column. The photo is NOT a column — it lives in `attachments` as the optional
-- `photo` slot (ADR 0014), served via the authenticated proxy `GET /api/meals/:id/photo`.
--
-- camelCase quoted columns + ISO TEXT timestamps, matching the Meal model. `aiAnalysis` + `override`
-- are JSON stored as TEXT (Schema.fromJsonString). `userId` is a plain FK with NO constraint
-- (inline-join approach). Nullable columns map to the model's FieldOption fields.
CREATE TABLE meals (
  "id"                 text not null primary key,
  "userId"             text not null,        -- FK to users(id), NO constraint
  "capturedAt"         text not null,        -- ISO-8601 Z; day-segmentation is client-side
  "aiAnalysis"         text not null,        -- the Estimate, JSON as TEXT
  "override"           text,                 -- manual Totals correction, JSON as TEXT (FieldOption)
  "lastRefinementText" text,                 -- most recent Refinement note (FieldOption)
  "savedAt"            text,                 -- non-null ISO ⇒ saved for re-log (FieldOption)
  "createdAt"          text not null,
  "updatedAt"          text not null
);
-- The Day-view read: a Member's meals in a captured-at range.
CREATE INDEX "meals_user_captured_idx" ON meals ("userId", "capturedAt");
-- The Saved-Meals read: a Member's saved meals.
CREATE INDEX "meals_user_saved_idx" ON meals ("userId", "savedAt");
