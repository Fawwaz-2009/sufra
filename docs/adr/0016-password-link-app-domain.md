# The Password link is an app-domain aggregate; the auth instance stays delivery-free

The Password link is an app-domain concept, not part of the Better Auth instance. The Better Auth config stays **delivery-free** — nothing is delivered; the Host hands the link over out of band. The link is a small aggregate `domain/password-link.ts` with `issue` / `show` / `redeem`, shaped by the conventions' meta-wisdom. It splits across two REST surfaces: a **host-only singular `password-link` sub-resource of the member** for issuance, and a **public token-addressed `password-links` resource** for redemption. `models/password-link.ts` + `db/password-links.ts` hold the row (opaque token, 24h TTL, `UNIQUE` on `userId`, cascade on user delete). The friendly `/set-password/:token` is the **page** (presentation); the **resource** is `password-links`.

## Why

The Password link is genuinely app-domain — a custom table and a custom flow — but every layer it touches obeys the house conventions, and its shape falls out of the meta-wisdom rather than being invented:

- **Reify verbs as nouns** (ADR 0012). "Issue a link," "redeem a link" become the `password-link` / `password-links` noun resources with `issue` / `show` / `redeem` living on the `PasswordLink` model.
- **The name is the cardinality** (ADR 0012). The member's link is a singular sub-resource (one live link per Member, `UNIQUE` on `userId`); the public surface is `password-links` addressed by token.
- **No-leak 404** (ADR 0013). Host issuance is host-only — 404 otherwise, not 403. Public `show` 404s on an invalid or expired token; no existence leak.
- **Pages vs resources** (ADR 0015). `/set-password/:token` is the SPA page; the data seam is `password-links`. The page presents what the resource serves.
- **Create returns only what the client can't know.** `issue` returns the token (the one thing the Host can't compute); redemption returns a set-cookie.
- **Aggregate-of-concerns** (ADR 0009). `PasswordLink` is a thin aggregate, not logic smeared across controllers.

**Delivery-free is the no-email analog of the style's `deliverSignInCode` decoupling.** The conventions decouple credential handoff from the channel that carries it. Sufra's channel is a human, not an email (ADR 0010 — no email anywhere): the Host generates the link and hands it over out of band. So the Better Auth instance takes no deliver function at all — there is nothing to deliver.

## Layer map

```
contract/
  admin/members/password-link.ts     host: POST (issue/regenerate), DELETE (revoke)
  password-links.ts                  public: GET /:token (show), POST /:token/password (redeem)
models/
  password-link.ts                   Model.Class — opaque token, 24h TTL, UNIQUE userId
db/
  password-links.ts                  Command repo
domain/
  password-link.ts                   aggregate: issue / show / redeem
controllers/
  admin/members/password-link.ts     thin → PasswordLink.*
  password-links.ts                  thin → PasswordLink.*
```

**Host side — issuance.** A singular `password-link` sub-resource of the Member: `POST /admin/members/:id/password-link` (create = issue or regenerate — **first-issue and reset are the same path**), host-only (404 otherwise per ADR 0013); optional `DELETE` = revoke. Member-create stays pure (returns the member); the link is always issued via this separate create.

**Public side — redemption.** A token-addressed `password-links` resource: `GET /password-links/:token` (`show` → validate the token, return `{ username, familyName }` for the set-password page; 404 if invalid or expired) and `POST /password-links/:token/password` (create the credential → consume the link → sign in).

## Considered alternatives

- **Bake the Password link into the Better Auth instance.** Rejected — there is nothing to deliver (no email, no SMS); the Host hands the link over out of band. It is an app-domain table and flow, not a Better Auth lifecycle concern. The BA instance stays delivery-free.
- **Member-create auto-issues the link and returns the first link in its response.** Rejected — member-create stays pure per "one endpoint per resource"; first-issue and reset collapse to one uniform path (`POST .../password-link`); the link is a transient credential-handoff artifact, not part of Member validity.
- **A flat `PUT /password-links/:token` to redeem.** Rejected — the link carries no password field, so `PUT`-replacing the link reads wrong. `POST /password-links/:token/password` reads honestly as "create the credential under this link."
- **The friendly `/set-password/:token` as the resource.** Rejected — that's the SPA page (presentation). The resource is `password-links`; the page consumes it.

## Consequences

- `contract/admin/members/password-link.ts` (host) + `contract/password-links.ts` (public); both controllers thin → `PasswordLink.*`.
- The Better Auth instance takes no deliver function.
- The public set-password redemption uses Better Auth's internal password hash + `updatePassword` (as today), deletes the link, and signs in.
- `models/password-link.ts` + `db/password-links.ts`: opaque base64url token, 24h TTL, `UNIQUE` on `userId` (regenerate replaces in place), cascade on user delete.
- Builds on the `identities`/`users` split and the build-once Better Auth instance from ADR 0010 — the PasswordLink flow is the no-email credential handoff that ADR references.
