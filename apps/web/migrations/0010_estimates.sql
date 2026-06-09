-- Estimates — the AI's read of a Meal, as an APPEND-ONLY attempt log (CONTEXT "Estimate"; ADR 0017).
--
-- One meal → many estimates over time: create makes the first, each Refinement or retry appends another.
-- The meal's CURRENT Estimate is the latest row with status = 'ok'; older rows and failed attempts are
-- history, kept for the retry flow + the cost trail. `analysis` (the structured vision output, JSON as
-- TEXT) is NULL when the attempt failed; `errorCode` is NULL when it succeeded. `mealId` is a soft FK
-- with NO constraint — the domain cascades on meal/Member delete (app-level, not DB-level).
CREATE TABLE estimates (
  "id"               text not null primary key,
  "mealId"           text not null,         -- soft FK to meals(id), NO constraint
  "status"           text not null,         -- 'ok' | 'failed'
  "analysis"         text,                  -- the Estimate content, JSON as TEXT (NULL when failed)
  "refinementText"   text,                  -- the note that produced it (NULL ⇒ a plain (re)try)
  "errorCode"        text,                  -- the failure code (NULL when ok)
  "modelId"          text not null,
  "promptTokens"     integer not null,
  "completionTokens" integer not null,
  "latencyMs"        integer not null,
  "createdAt"        text not null
);
-- The meal's estimate log, newest first — backs currentForMeal / latestForMeal / allForMeal.
CREATE INDEX "estimates_meal_idx" ON estimates ("mealId", "createdAt");
