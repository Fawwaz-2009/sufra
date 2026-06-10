-- Meals — one captured photo a Member logged (CONTEXT "Meal").
--
-- The AI's read of the meal is NOT here — it lives in the `estimates` child log (one meal → many
-- estimates; current = latest "ok"), so a meal can exist while its first estimate is still failed/pending
-- (the retry flow, ADR 0017). The photo is NOT a column either — it lives in `attachments` as the
-- optional `photo` slot (ADR 0014), served via the authenticated proxy `GET /api/meals/:id/photo`.
--
-- camelCase quoted columns + ISO TEXT timestamps, matching the Meal model. `override` is JSON stored as
-- TEXT (Schema.fromJsonString). `userId` is a plain FK with NO constraint (inline-join approach).
-- Nullable columns map to the model's FieldOption fields.
CREATE TABLE meals (
  "id"                 text not null primary key,
  "userId"             text not null,        -- FK to users(id), NO constraint
  "capturedAt"         text not null,        -- ISO-8601 Z; day-segmentation is client-side
  "override"           text,                 -- manual Totals correction, JSON as TEXT (FieldOption)
  "savedAt"            text,                 -- non-null ISO ⇒ saved for re-log (FieldOption)
  "createdAt"          text not null,
  "updatedAt"          text not null
);
-- The Day-view read: a Member's meals in a captured-at range.
CREATE INDEX "meals_user_captured_idx" ON meals ("userId", "capturedAt");
-- The Saved-Meals read: a Member's saved meals.
CREATE INDEX "meals_user_saved_idx" ON meals ("userId", "savedAt");
