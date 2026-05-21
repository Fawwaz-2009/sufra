# Routes are folders; everything a route needs lives next to it

Every non-trivial route is a directory under `src/routes/` containing `route.tsx` (the route definition + orchestrator component) plus dash-prefixed siblings that hold the route's local components, queries, types, and helpers. Files used only by one route live next to that route. Files used across the app stay in `src/components/` or `src/lib/`. The TanStack Router `routeFileIgnorePrefix: "-"` default excludes dash-prefixed siblings from `routeTree.gen.ts` so they remain importable modules without polluting the route tree.

## Why

The flat route files had grown to 400–800 lines because the codebase strictly preferred co-location over premature extraction. That was the right instinct, but flat files exhausted the trick — a 794-line `profile.tsx` containing six sheets, four sections, two shared primitives, and a mutation hook is co-located in name only; the reader has to scroll past every concern to find the one they're working on. Folder-per-route restores the co-location win at the file-tree level: each route's tree shows its concerns at a glance, and deleting a feature is a single `git rm -r`.

The Ruby on Rails "concerns" instinct maps directly onto TSR's `-` convention: scoped pieces of a unit, physically grouped with the unit, ignored by the framework's auto-discovery.

## Convention

```
src/routes/<route-segment>/
├── route.tsx              The route definition + orchestrator component.
├── -queries.ts            queryOptions for this route + exported queryKey constants.
├── -search.ts             validateSearch schema + search helpers (when route has search params).
├── -helpers.ts            Route-local hooks + utility functions used by multiple sibling components.
├── -types.ts              Route-local types not derived from a domain schema (e.g. wizard Draft state).
└── -components/
    ├── <some-component>.tsx
    ├── <another-component>.tsx
    └── …
```

Routes that are small (login, setup, set-password, how-it-works) stay as flat files. The threshold isn't a line count — it's the moment a route gains a single helper component that isn't trivially inline. The first extraction earns the folder.

### `route.tsx` (not `index.tsx`) inside folders

TanStack Router treats `<folder>/route.tsx` as the **encapsulation pattern** — semantically identical to a flat `<folder>.tsx`, just contained. No `<Outlet />` required when the route has no child routes; if children appear later (e.g. `/profile/edit`), the existing `route.tsx` becomes the layout naturally and an `index.tsx` is added next to it for the parent path. Migration cost: zero.

`<folder>/index.tsx` has a *different* meaning: it's the exact-path match when the folder is acting as a layout container. Using `index.tsx` for a leaf route works today but reads incorrectly to a contributor who expects the layout idiom.

For the root index route, `src/routes/index/route.tsx` resolves to URL `/` and is recognized by the bundler plugin's encapsulation logic — the convention is uniform across every route.

### Where files live

| Where | Used by |
|---|---|
| `src/routes/<r>/-components/` | Exactly one route. Most route-specific UI lives here. |
| `src/components/` | Two or more routes, OR a generic primitive (MealCard, DaySummaryPanel, BottomNav). Promotion requires a deliberate move. |
| `src/lib/` | App-wide utilities (the Hono RPC client, auth-context, date helpers, units). |

The promotion rule: **share when proven, not when anticipated.** Two routes may have nearly-identical `UnitToggle` components living in their respective `-components/` folders. If they ever need to diverge for one wizard step or one sheet variation, they diverge cleanly. If they truly stay identical across three or more routes, that's the time to promote to `src/components/`. The verbosity of two near-copies is cheaper than the constraint that a shared component must satisfy every caller.

### Co-located queries

Each route owns the queryOptions it consumes. `-queries.ts` files export both the `queryOptions(...)` factories and the **queryKey constants** as named exports — cross-route invalidation imports the constant rather than hand-typing the key string. Example: `weekMealsKey(date)` in `routes/index/-queries.ts` is imported wherever someone needs to invalidate the Day view's cache.

This contradicts an earlier proposal to centralize queries in `src/lib/queries.ts`. The co-location principle wins: queries that belong to one route live with the route. Cache-key drift between files is prevented by importing the exported constant.

### The orchestrator pattern in `route.tsx`

`route.tsx` reads top-to-bottom as:
1. `createFileRoute(...)({...})` — the route definition (beforeLoad, loader, validateSearch, pendingComponent, errorComponent, component).
2. The orchestrator component that composes child components — typically the place where mutations are wired, navigation handlers live, and global-to-the-route state (open sheets, selected items, draft buffers) is managed.

Mutations that own a single concern push **into** the child component that owns the data flow (the admin slice does this — `ModelSelect` owns `patchSettings`, `AddMemberForm` owns `addMember`, `MembersList` owns `generateLink`, `DeleteMemberDialog` owns `deleteMember`). Mutations that coordinate across children stay in `route.tsx` (the index slice's upload mutation, which affects both the meals list and the cache invalidation).

## Considered alternatives

- **Flat files with a `-<route>/` sibling folder.** Rejected — the dash-prefixed sibling reads as a peer of the route rather than a sub-concern of it. Folder-per-route makes the hierarchy match the URL hierarchy: route at the top, supports nested below.
- **`<folder>/index.tsx` for leaf routes.** Rejected — `index.tsx` has a distinct layout-aware semantic in TSR (exact match of the parent path when the folder is acting as a layout container). Using it for leaf routes works today but breaks the layout idiom the moment a child route is added.
- **Centralized `src/lib/queries.ts`.** Rejected — contradicts the co-location principle this ADR formalizes. Cross-route invalidation handled via exported queryKey constants.
- **File-name suffix patterns (`override-editor.colocated.tsx`).** Rejected — awkward double extensions; the folder structure does this work without naming gymnastics.
- **Keep flat files; rely on prose comments to delimit sections within them.** Rejected — that's what 794-line `profile.tsx` was. Comments don't make a file navigable; the file tree does.

## Consequences

- Adding a new non-trivial route is a folder + `route.tsx` + (optionally) `-components/`. No top-level `src/` sprawl.
- Deleting a feature is `git rm -r src/routes/<r>/`. Queries, types, components, helpers all go with it.
- Reviewing a PR scoped to one route shows changes inside one folder. Cross-route changes are visible by their cross-folder edit footprint — making accidental coupling more obvious.
- `routeTree.gen.ts` regeneration is unaffected: dash-prefixed siblings are excluded by TSR's default `routeFileIgnorePrefix: "-"`. The route IDs and URLs are unchanged from the flat-file versions; only the import paths in the generated tree differ.
- A small new gotcha: when adding the first non-trivial sub-component to a flat route, the contributor must convert the route to folder form (move `<x>.tsx` → `<x>/route.tsx`, then add `-components/`). This is a small ceremony at the moment of growth, paid once per route.
