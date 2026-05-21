# Isomorphic files live in `worker/<domain>/isomorphic/`, named for what they are

Files that the SPA value-imports from the worker live in a `isomorphic/` sub-directory of their owning domain — `worker/profile/isomorphic/`, `worker/meals/isomorphic/`, `worker/auth/isomorphic/`. The directory name is the documentation: anything under `isomorphic/` is bundle-safe for the SPA; everything else under `worker/` is worker-runtime and may be `import type`-only from the SPA.

## Why

ADR 0004 made drizzle the source of truth and let types flow from `worker/` to `src/` via `import type`. But it left a legibility gap for *value* imports: `import { resolveTotals } from "../../worker/meals/totals"` reads like the SPA coupling to worker internals, even though `totals.ts` is a pure function with no drizzle runtime deps. A reader couldn't tell from the import path whether the import was safe; the discipline lived only in `eslint.config.js` and the ADR. New contributors hit "wait, why is the SPA reaching into `worker/`?" friction.

The fix is layout-as-documentation. Anything safe to ship to the browser lives in a `isomorphic/` directory. Co-location is preserved (the Profile-formula module sits next to the Profile schema), and the path now tells the truth.

## Promise A (runtime) vs Promise B (type-graph)

This ADR adopts **Promise A**: isomorphic files compile to runtime code with zero imports from worker-runtime modules. They may `import type` from anywhere — including `worker/<domain>/schema.ts` and `worker/db/schema.ts` — because those imports are erased under `verbatimModuleSyntax: true`.

Promise B (type-graph isolation — never `import type` from worker either) was rejected. It would force the canonical row types out of `worker/<domain>/schema.ts` and either reintroduce hand-typed parallel definitions or weaken ADR 0004's "drizzle is the source of truth" rule. The runtime guarantee is what affects bundling, security, and reasoning about deploy artifacts; the TypeScript dependency graph adds no runtime cost.

Concretely: `worker/profile/isomorphic/derive.ts` may `import type { ProfileSnapshot } from "../schema"` (worker-runtime file). It may NOT `import { profileEditSchema } from "../schema"` (value import would pull drizzle).

## Directory layout

```
worker/
  db/                                  worker-runtime (drizzle tables)
  routes/                              worker-runtime (Hono routers)
  profile/
    isomorphic/
      constants.ts                     enum tuples + numeric bounds
      derive.ts                        Mifflin formula, snapshotFor
    schema.ts                          worker-runtime (drizzle-zod)
    operations.ts                      worker-runtime
  meals/
    isomorphic/
      totals.ts                        resolveTotals (override-first)
      models.ts                        MODELS list for admin UI
    schema.ts                          worker-runtime
    operations.ts                      worker-runtime
    estimator/
      index.ts                         worker-runtime (OpenRouter)
      schema.ts                        the `MealAnalysis` zod schema
      prompts.ts, errors.ts            worker-runtime
  auth/
    isomorphic/
      permissions.ts                   better-auth ac (consumed by both runtimes)
    index.ts                           worker-runtime (createAuth)
    middleware.ts                      worker-runtime
    password-link.ts                   worker-runtime
  index.ts, types.ts, errors.ts        worker-runtime

src/                                   SPA-only
```

`worker/meals/estimator/schema.ts` — the `MealAnalysis` zod schema — is not under `isomorphic/` today because no SPA file value-imports it. Its only dependencies are `zod` (already in the SPA bundle for form schemas). If a future SPA need arises (e.g. client-side validation of meal-history backups), it can move to `worker/meals/isomorphic/analysis-schema.ts` with no ADR change.

## Enforcement

ESLint's `no-restricted-imports` applies the same value-import ban to two surfaces:

1. **`src/**`** — SPA code. Value imports from worker-runtime files are banned; type imports allowed.
2. **`worker/**/isomorphic/**`** — isomorphic files. Same rule; this enforces Promise A at the isomorphic boundary too — an `isomorphic/` file that drifts and value-imports `worker/profile/schema.ts` would fail lint before it lands.

The rule enumerates worker-runtime paths explicitly because ESLint v9's `no-restricted-imports` uses `ignore` package matching (gitignore semantics), where re-including a file under an implicitly-matched parent directory isn't reliable. New worker-runtime files added under `worker/<domain>/` must be listed; new `isomorphic/` files require no change.

The two surfaces share one rule via the `files: ['src/**/*.{ts,tsx}', 'worker/**/isomorphic/**/*.{ts,tsx}']` glob.

## Validator co-location revisited

ADR 0004 specified canonical domain-write zod schemas live in `worker/<domain>/schema.ts`. That stays true. Profile-edit schemas (`profileOnboardSchema`, `profileEditSchema`) and Meals-write schemas (`mealOverridePatchSchema`, `mealRefineSchema`) are drizzle-zod runtime — worker only. Routes import them from there.

`worker/<domain>/isomorphic/constants.ts` provides the bounds the SPA needs to declare its own *local* form schemas without value-importing the worker's drizzle-zod schemas. The constants are the shared truth; the runtime validators are separate per side. The server remains canonical.

## Considered alternatives

- **One top-level `shared/` or `isomorphic/` directory** (the layout I initially proposed). Rejected — domain co-location matters. Splitting profile logic across `worker/profile/` and `shared/profile/` is harder to reason about than `worker/profile/{isomorphic,schema,operations}`. The user explicitly chose co-location over centralized grouping.
- **File-name suffix (`derive.isomorphic.ts`)**. Rejected — awkward double extensions; doesn't fit existing project conventions.
- **`@iso/*` path alias** to shorten import paths. Rejected — the alias would obscure that `worker/profile/isomorphic/derive.ts` lives *inside* the Profile domain. The verbose relative path `../../worker/profile/isomorphic/derive` is itself documentation.
- **In-file header comments only.** Rejected — comments are invisible at the import site. The directory name is visible to every reader of every import line.
- **Strict Promise B** (type-graph isolation). Rejected — see "Promise A vs Promise B" above.

## Consequences

- The directory name conveys the bundling guarantee. `import { ... } from ".../isomorphic/..."` is self-documenting; `import { ... } from ".../schema"` is obviously worker-runtime.
- Adding a new isomorphic helper is a deliberate physical act: place it in `worker/<domain>/isomorphic/`. There's no in-line annotation to drift.
- ESLint enforcement extends to a second surface (`worker/**/isomorphic/**`), preventing isomorphic files from accidentally value-importing worker-runtime modules.
- ADR 0004's file-layout section is superseded by this ADR. Its type-discipline rules (drizzle as source of truth, `$inferSelect` for row types, `.pick/.omit/.partial` for sub-schemas) remain in force unchanged.
