# Domain shapes have one source — drizzle tables — and flow outward via inference and composition

> **Superseded by ADR 0009.** The drizzle `$inferSelect` + `Pick` projections + drizzle-zod discipline below is replaced by `Model.Class` as the single source of truth, the `Command` persistence model, and the `views/` serializers under the Effect + Cloudflare house style. Retained for historical rationale.

The drizzle table is the canonical shape for any domain entity that touches the DB. Zod schemas for HTTP write operations come from `drizzle-zod` (`createInsertSchema`, `createUpdateSchema`, `createSelectSchema`) with field refinements applied at the call site. TypeScript row types come from `typeof table.$inferSelect`. Sub-schemas and sub-types are composed from those canonicals via zod's `.pick/.omit/.partial/.extend` (runtime) or TypeScript's `Pick/Omit/Partial` (compile-time). No hand-authored shape mirrors a drizzle table.

## Why

Before this discipline, the same shape was encoded 2–5 times: drizzle column, inline zod validator, TypeScript union, hand-typed component prop. The enum `["sedentary", "light", "moderate", "active"]` appeared in five places. `MealOverride` was hand-typed in `db/schema.ts` AND re-typed as `Override` in `src/routes/meals.$id.tsx`. `MealDetailData` (25 lines in `meals.$id.tsx`) mirrored the `meal` row and the `MealAnalysis` zod schema by hand. Every schema change was a multi-file sweep that nothing forced you to remember.

Pinning all of these to the drizzle table — and letting the type system propagate from there — collapses the drift surface to zero for any change that doesn't touch column semantics.

## File layout per domain

```
worker/db/schema.ts                drizzle tables. Source of truth for column shape.
                                   Imports drizzle. Worker runtime.
worker/<domain>/constants.ts       Isomorphic leaf — enum tuples (e.g. ACTIVITY_LEVELS),
                                   numeric bounds (WEIGHT_KG_MIN/MAX). No drizzle imports.
                                   Re-used by the table definition AND the SPA.
worker/<domain>/schema.ts          drizzle-zod input/select schemas + inferred row types.
                                   Imports drizzle-zod + the table. Worker runtime; types
                                   flow to the SPA via `import type` (verbatimModuleSyntax
                                   erases the import).
worker/<domain>/derive.ts          Isomorphic leaf — pure formula functions. No drizzle.
worker/<domain>/operations.ts      Worker-only. Imports the domain schema + types.
worker/routes/<x>.ts               Worker-only. Imports schemas for `zValidator`.
```

## Naming

| Kind | Pattern | Example |
|---|---|---|
| Drizzle table | lowerCamel noun | `profileLog`, `meal` |
| Enum tuple const | UPPER_SNAKE plural | `ACTIVITY_LEVELS`, `SEX_VALUES` |
| Enum union type | PascalCase singular | `ActivityLevel`, `Sex` |
| Row type | PascalCase noun | `ProfileSnapshot = typeof profileLog.$inferSelect` |
| Operation input schema | `<noun><Operation>Schema` | `profileOnboardSchema`, `profileEditSchema` |
| Operation input type | `<Noun><Operation>Input` | `ProfileOnboardInput`, `ProfileEditInput` |
| Response projection type | PascalCase noun | `MealListItem = Pick<Meal, ...> & {...}` |
| Domain-only zod schema (no table) | PascalCase noun, schema and type share the name | `MealAnalysis` |

## Composition rule

**Derive when the relationship is structural. Declare when it's coincidental.**

- *Structural* = "this IS a projection of X." Sub-schemas, response projections, sheet/form schemas. Derive via `schema.pick/omit/partial/extend` or TS `Pick/Omit/Partial`.
- *Coincidental* = "today these happen to share fields, but they're different concepts." Declare independently. Two domain entities are not the same just because they currently have the same columns.

Long chains (`Pick<Omit<Partial<...>, "x">, "y">`) defeat the purpose — at that point, declare.

## Frontend / backend split

- **Types** flow isomorphically. The SPA `import type`s row + projection types from `worker/<domain>/schema.ts`. Mechanically guaranteed under `verbatimModuleSyntax: true` — no runtime code is bundled.
- **Runtime zod schemas** in `worker/<domain>/schema.ts` are worker-only. The SPA does NOT import them as values; doing so would pull drizzle + drizzle-zod into the client bundle.
- **The SPA may define its own form schemas** inside route/component files, using bounds from `worker/<domain>/constants.ts`. The server is the canonical validator. Client form validation is a UX affordance for immediate feedback, not enforcement.
- **Hono RPC inference** remains the preferred way for the SPA to type API response envelopes (`InferResponseType<typeof api.api.meals.$get>`). Domain schema files are for cases where the worker side ALSO needs the projection.

## Considered alternatives

- **DTO layer between domain types and API contracts.** Rejected — Hono RPC already infers response shapes from handler return types. A separate DTO layer adds a fourth representation of every shape.
- **Generate isomorphic zod schemas via a build step (serialize the drizzle-zod output to a leaf file the SPA can import).** Rejected — too heavy for the win. The SPA's forms are small and few; local zod schemas with shared bounds are sufficient.
- **Bundle-size grep in CI as the enforcement.** Rejected — catches mistakes after they ship. ESLint catches them on save.
- **Use `Effect.Schema` (or another runtime schema library) for isomorphism.** Rejected — the codebase is already deep on zod v4. Switching frameworks is unwarranted.

## Enforcement

ESLint `no-restricted-imports` rule in the `src/` config: bans value imports from `worker/**/schema.ts`, `worker/db/**`, `worker/routes/**`, `worker/auth/middleware.ts`, `worker/auth/password-link.ts`, and `worker/<domain>/operations.ts`. Type imports (`import type`) from these paths remain allowed. Value imports from `worker/<domain>/constants.ts` and `worker/<domain>/derive.ts` remain allowed (isomorphic leaves).

## Consequences

- Adding a column to a drizzle table propagates to the insert/update/select schemas, the inferred row type, every consumer of `Pick<Row, ...>` projections, and any zod sub-schema built via `.pick/.omit`. One change.
- Renaming `user → member` (pending, see CLAUDE.md) becomes mechanical: rename the table, every dependent schema and type follows.
- Hand-authored shape mirrors (`MealCardData`, `MealDetailData`, `Override`, `Totals` duplicates) are removed during the per-domain migration. New ones do not get written.
- The SPA's bundle stays free of drizzle/drizzle-zod, enforced by ESLint. Types remain isomorphic via `import type` under `verbatimModuleSyntax: true`.
- Validators in `worker/routes/<x>.ts` come from `worker/<domain>/schema.ts` for canonical domain writes; only ad-hoc per-route shapes (query ranges, photo-upload form, password body) remain inline.
