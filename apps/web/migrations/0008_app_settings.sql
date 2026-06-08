-- app_settings — the instance config SINGLETON (CONTEXT "Setup"). Exactly one row, keyed `id = 1`
-- (the CHECK enforces it), created at Setup and edited from Admin. Holds the Host-chosen vision model
-- (read by the Meal estimator) and the family name (the "{familyName} Sufra" copy). The reset baseline
-- drops the old dead columns (default_language, deficit_safety_warning_enabled) — translation and the
-- deficit floor are deferred. camelCase quoted columns + ISO TEXT timestamp, like every app table.
CREATE TABLE app_settings (
  "id"            integer not null primary key,
  "visionModelId" text not null,
  "familyName"    text not null default 'My',
  "updatedAt"     text not null,
  CHECK ("id" = 1)
);
