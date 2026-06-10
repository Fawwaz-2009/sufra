-- users — the app-owned domain "person" (the product's Member; Host or Member by `role` on the
-- identity). Better Auth owns `identities` (the credential: id + username + role); this table is
-- the person aggregate root. Deliberately THIN: the plan inputs are the append-only
-- `profile_snapshots` collection (a later migration); no display name in v1 (Members are
-- username-only). See ADR 0010 / ADR 0011.
--
-- SHARED PRIMARY KEY: `id` IS the identity id (Better Auth's user id), copied in at sign-up by the
-- user.create.after hook. One id per human; every app resource references it as `userId` (the
-- universal anchor). A missing row for an authenticated identity is a defect, never a 404.
-- camelCase quoted columns + ISO TEXT timestamps, like every app table.
CREATE TABLE users (
  "id"        text not null primary key,   -- = identities.id (the universal user anchor)
  "createdAt" text not null,
  "updatedAt" text not null
);
