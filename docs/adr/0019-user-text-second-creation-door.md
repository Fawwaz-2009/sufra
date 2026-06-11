# User text as the second creation door; the Meal's text source material rides the Estimate

Allow a Meal to be created **by text description** — `POST /meals` becomes `{ photo?, userText?,
capturedAt? }` with the create-time rule **at least one of photo | userText** (both together is valid
and feeds the vision call the extra context). There is **no new endpoint and no `description` column on
`meals`**: the Member's text rides the first Estimate row's existing `refinement_text` — the same field
Refinement text already uses — under one wire name, `userText`, whichever door it enters through
(CONTEXT "User text"). The Meal keeps **one shape** regardless of which door created it: the photo is
the optional `photo` Attachment slot, the text is in the Estimate log, and everything downstream
(Override, Totals, Saved/clone, destroy) is door-blind.

## Why

A photo-less Meal was already structurally possible — the photo slot is optional at the model level;
"a photo is required" was only a create-time rule (CONTEXT "Attachment"). What text creation actually
needed was a **home for the text**, and the obvious candidate (a `description` column on `meals`) was
rejected on product grounds: it would exist only for text-created Meals and be meaningless (or
ambiguously generated?) for photo Meals — the Meal would effectively fork into two shapes, two entities
pretending to be one. Storing the text where Refinement text already lives keeps the invariant *"the
Member's free text that informs an Estimate is one concept"* true in the schema, not just the glossary
— and it means **zero migration**: the column, the `MealView.lastRefinementText` field (which already
surfaces the description on the detail screen), and the Improve-sheet prefill all work unchanged.

## The mechanics that fall out

- **Reestimate source resolution** (`Meal.reestimate`): photo slot has bytes → photo + optional new
  text (unchanged); slot empty → **text-only call**, text = the payload's `userText` ?? the latest
  attempt's stored text. So a bare retry of a failed text-Meal re-runs the original description, and a
  Refinement of a text-Meal = editing the prefilled description (replace, not merge — same semantics
  photo Refinement always had).
- **One source-aware prompt**: `getSystemPrompt` takes the source (`photo | text`) and swaps only the
  framing sentence + the not-analyzable section; identification/estimation/clarification/locale rules
  stay shared, plus one text-only line (no quantities ⇒ assume typical servings, surface portion
  Clarifications). Evals keep importing the same function — the no-drift guarantee holds.
- **The ledger `kind` is the door, not the text**: a create-door attempt records `kind: "estimate"`
  even when text is present (it is the first read, not a Refinement), so `Estimatable.estimate` takes
  the kind from its caller instead of inferring it from text presence.
- **Add/replace photo, never re-estimate**: the reified singular photo resource (`contract/meals/photo.ts`)
  gains `create` — `POST /meals/:id/photo` sets/replaces via `Meal.photo.attach` (204; the standing
  Estimate is untouched). The next Refinement reads the slot, so an added photo upgrades future re-runs
  to photo+text without re-running anything now. No `destroy` in v1.
- **Wire stays additive (ADR 0018)**: new optional payload fields, a new endpoint, and a new optional
  view field `hasPhoto?: boolean` (absent — i.e. an old backend — means true). `photoUrl` stays
  non-nullable and always minted: making it nullable would break a deployed store app's *entire list
  decode* the moment one photo-less Meal exists. A new app against an old backend handles the missing
  capability by **attempt + friendly error** ("update your deployment"), not a capability probe — no
  new wire surface for a transitional window.

## Considered alternatives

- **A `description` column on `meals`** — the "text twin of the photo slot". Rejected (above): forks
  the Meal into two shapes; the field is unexplainable for photo Meals.
- **A separate creation endpoint** (`POST /meals/described` or a second group). Rejected — it is the
  same Meal being created; a per-variant endpoint is a verb pretending to be a resource
  (rest-resources.md). The payload variant is a domain rule on `Meal.create`.
- **One-shot text (don't persist)**. Rejected — a failed first call would leave a Meal with no source
  material at all, making ADR 0017's retry state unreachable for text Meals.
- **`photo` XOR `userText`**. Rejected — photo+text at create is the cheapest accuracy lever the evals
  found (context closes most of the 78%→91% gap), and the vision call already accepts both.
- **A capability probe / capabilities endpoint** for old self-hosted backends. Rejected — permanent
  wire surface for a transitional problem; the friendly error self-explains the fix.

## Consequences

- CONTEXT "Meal" is no longer photo-defined ("a single eating event… photographed and/or described");
  "User text" is a new glossary term; "Refinement" covers the text-only re-run.
- `refinement_text` is now a historically-named column — it predates the create door. The name stays
  (renaming the column or the public `lastRefinementText` view field would be churn/breaking for zero
  behavior); the glossary records the mismatch.
- The web SPA ships the capability **server-side before its UI catches up** (mobile-first pass) — the
  nothing-is-mobile-only parity invariant is deliberately broken until the web Today gains the same
  three-path entry.
