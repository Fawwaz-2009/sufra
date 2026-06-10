# Re-platform Sufra onto the Effect + Cloudflare house style, in place

Rebuild Sufra's backend on the fawwaz-coding-style: Effect v4; `Model.Class` as the single source of truth; the `Command<A>` persistence model (`makeTable` CRUD + named Command-returning reads, `run` / `atomically`) — no ORM query builder exposed to callers; an `HttpApi` contract with thin `HttpApiBuilder` controllers; domain aggregates composed of concerns; the layered `worker/` tree. The frontend stays a SPA (ADR 0015) but adopts the typed contract data seam. The strategy is **in place** — transform `apps/web`, no parallel clone — with **no backward compatibility** (delete the old Hono + Drizzle code as replacements land; no dual-stack coexistence) and a **nuked DB on a reset migration baseline** (no data migration; collapse the 11 Drizzle migrations + the `0008` no-op into a fresh baseline — `0001_better_auth.sql` from the Better Auth CLI + clean domain migrations). Built on a branch in tracer-bullet vertical slices (auth → meals → member → admin → progress), each end-to-end; flipped to main and deployed on a clean prod DB at parity.

## Why

The changes are foundational substrate, not strangle-friendly: Drizzle → Command/`Model.Class`; the `user` → `identities`+`users` split (ADR 0010) touches every `userId`; Better Auth onto Kysely + KV; the Effect runtime threaded through every handler. The strangler tax — running two stacks against one D1 mid-schema-migration — is the only real obstacle to in-place, and dropping backward compatibility plus nuking the DB dissolves it. The app is dogfooding (small, household, not uptime-critical), so "keep shipping continuously" is low value here. The house style is the considered default; we follow it rather than bolting fragments onto the existing stack.

## Layer map (worker/)

```
worker/
  contract/        browser-safe typed routes (HttpApi); nests by route
  models/          Model.Class definitions; flat by concept
  views/           serializers; nest by route; singular
  db/              Command repos; flat, plural; + sql.ts, table.ts
  domain/          aggregates + concerns; concerns/ holds the shared -able set
  controllers/     thin HttpApiBuilder handlers; nest by route
  middleware/      authentication + <Resource>Scoped
  auth/            Better Auth subsystem (Kysely + KV — ADR 0010)
  estimator/       the AI leaf as an Effect service
  blobs/           R2 transport (ADR 0014)
  server.ts        the composer
```

`server.ts` is a two-seam handler: `/api/auth/*` → Better Auth, `/api/*` → the Effect handler, else the SPA. `contract/`, `models/`, and `views/` are the browser-safe layer set — the new boundary that replaces the old `worker/<domain>/isomorphic/` directories.

## Considered alternatives

- **In-place strangler with backward compatibility.** Rejected — running two stacks against a shared, moving schema is high cost for low benefit at dogfooding scale; the dual-stack tax is the very thing this decision removes.
- **Fresh separate repo / clone.** Rejected — the rebuild is in place; once backward compatibility is dropped there is no reason to clone.
- **Adopt only some conventions atop Hono + Drizzle.** Rejected — half-measures; the foundation (`Model.Class` + `Command`, the Effect runtime, the layered tree) is the value, and it doesn't compose with the old query-builder stack.

## Consequences

- Every `worker/` file changes idiom. pnpm + Turborepo stay; the two-app monorepo shape is unchanged.
- The estimator stays a leaf the eval harness imports unchanged — `apps/evals/estimator-provider.ts` keeps its import path into the estimator.
- A split tsconfig (browser-safe vs worker) enforces the `contract/models/views` boundary.
- Sheds the drizzle-kit interactive-rename baggage and the `0008` no-op migration; the baseline resets clean.
- **Supersedes ADR 0004** — its typing/schema discipline (drizzle `$inferSelect` + `Pick` projections + drizzle-zod) is replaced by `Model.Class` as the single source of truth, the `Command` model, and the `views/` serializers.
- **Supersedes ADR 0005** — the `worker/<domain>/isomorphic/` boundary is replaced by the browser-safe `contract/`, `models/`, and `views/` layer set.
- The downstream slices are governed by their own ADRs: identity/auth (ADR 0010), the Member aggregate (ADR 0011), REST reification (ADR 0012), uniform 404 scoping (ADR 0013), media (ADR 0014), the SPA data seam (ADR 0015), and the Password link (ADR 0016).
