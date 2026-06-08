# Reify non-CRUD verbs as noun resources; the produces-entity→plural / replaces-state→singular rule

HTTP is REST resources with a closed verb set — index, show, create, update, destroy. Every non-CRUD action is reified into a **noun resource**; the expressive verb lives on the domain model, never on an invented controller verb. On the Meal aggregate this yields four sub-resources: `override` (singular — `PUT` set / `DELETE` reset → `Meal.override.set` / `.reset`), `refinement` (singular, create-only — `POST /meals/:id/refinement` → `Meal.refine`, which replaces the Estimate in place and overwrites `last_refinement_text`), `saved` (singular toggle — `POST` / `DELETE /meals/:id/saved` → `Meal.save` / `.unsave`, 204 on both, with the saved list expressed as the scope `GET /meals?saved`), and `clones` (plural, create-only — `POST /meals/:id/clones` → `Meal.clone`, returning 201 + the new independent Meal). The Meal has **no plain `update`**.

## Why

Expressiveness belongs in nouns and model methods, not in invented controller verbs — the 37signals/Rails position. Override, Refinement, Saved Meal, and Clone are already nouns in CONTEXT.md, so reifying them adds no new vocabulary; it only makes the wire match the glossary. The closed CRUD set keeps the contract uniform and the controllers thin.

`PUT`-replace for the override **kills the null-vs-absent PATCH bug**: the old per-field `PATCH …/override` had to distinguish "absent = leave alone" from "null = clear," and clearing a field silently no-op'd when the empty value was skipped. A `PUT` that replaces the whole override and a `DELETE` that resets it remove the ambiguity entirely — there is no partial-field semantics left to get wrong.

## The cardinality discriminator (the load-bearing rule)

Singular vs. plural is settled by one question: **does the action produce a new retained entity, or replace a single state in place?**

- **Produces a new retained entity → plural, create-only.** `clones` is plural because `Meal.clone` mints a real Meal that graduates to `/meals` and is managed there; many clones can result over time. It is POST-only — there is no retained "clones" collection to `index`, no member to `show` or `destroy`, because each clone is a first-class Meal living under `/meals`, not a child of its source.
- **Replaces a single state in place → singular.** `refinement` and `override` are singular because each replaces one state recorded on the meal row (the Estimate columns; the override columns) and retains nothing of its own. A Refinement is create-only — running it again replaces the prior Estimate; there is no Refinement member to fetch or delete. `saved` is a singular toggle over one boolean-ish state.

This is the same discriminator that distinguishes a possessive sub-thing from a spawned entity throughout the contract; applied uniformly it removes every ad-hoc singular/plural judgement call.

## Concerns and the aggregate

Each capability is an `-able` concern — `Overridable`, `Refinable`, `Saveable`, `Cloneable` — and the Meal aggregate is their **sole importer**. The composition rule mirrors the style: spread-flat for the meal's own verbs (`Meal.save`, `Meal.refine`, `Meal.clone`), group under a namespace for a possessive sub-thing (`Meal.override.set` / `.reset`, the way `Card.image.*` groups a card's image operations). The aggregate reads as the meal's verbs at the top level and its owned sub-thing nested.

## Considered alternatives

- **Custom verbs — `PATCH …/override`, `POST …/refine`, `PATCH …/saved`, `POST /meals/clone`.** Rejected — RPC drift; verbs on the controller instead of nouns on the model, the exact thing the closed CRUD set exists to prevent.
- **Plural `refinements`.** Rejected — a Refinement replaces a single state and retains nothing of its own, so by the cardinality discriminator it is singular and create-only.
- **Fold clone into `POST /meals { from }`.** Rejected — overloads the photo-create endpoint with two distinct modes (different inputs, validation, code path); `POST /meals/:id/clones` reads honestly and stays single-purpose. (This is ADR 0008's `POST /api/meals` `sourceMealId` rejection restated in the reified contract.)
- **Per-field PATCH override.** Rejected — the null/absent ambiguity bug; `PUT` set + `DELETE` reset is unambiguous.

## Consequences

- Contract layout: `contract/meals.ts` plus `contract/meals/{override,refinement,saved,clones,photo}.ts`; the `controllers/` tree nests the same way, each controller thin and delegating to `Meal.*`.
- The override null-clearing bug disappears — there is no per-field PATCH left to mishandle.
- The saved list is a scope (`GET /meals?saved`), not a separate endpoint; saved-status stays communicated by filtering, as in ADR 0008.
- **Evolves ADR 0008.** The marker-on-the-row model and the clone-the-source basket model are preserved; only the endpoints are reified: `GET /api/meals/saved` → `GET /meals?saved`; `PATCH /api/meals/:id/saved` → `POST` / `DELETE /meals/:id/saved`; `POST /api/meals/clone` → `POST /meals/:id/clones`. The photo sub-resource and authenticated-proxy serve are ADR 0014; ownership scoping that 404s every miss is ADR 0013; this contract sits within the Effect + Cloudflare house style of ADR 0009.
