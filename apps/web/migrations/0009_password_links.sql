-- password_links — single-use, Host-issued credential-handoff tokens (CONTEXT "Password link"; ADR 0016).
-- Opaque base64url token; 24h TTL; UNIQUE on userId so there is one active link per Member (regenerate
-- replaces in place via the repo's ON CONFLICT (userId) upsert). No FK (constraint-free, inline-join
-- style) — cascade-on-Member-delete is an explicit app-domain delete in `User.members.destroy`, never a
-- DB trigger. `token` is UNIQUE (its index backs the public token lookup). camelCase quoted columns + ISO
-- TEXT timestamps, like every app table.
CREATE TABLE password_links (
  "id"        text not null primary key,
  "userId"    text not null unique,
  "token"     text not null unique,
  "createdBy" text not null,
  "createdAt" text not null,
  "expiresAt" text not null
);
