# Saved Meals are markers on existing Meal rows; re-log clones the source Meal (basket model)

> **Evolved by ADR 0012.** The marker-on-the-row model and the clone-the-source basket model are preserved; only the endpoints are reified as REST sub-resources of the Meal: `GET /api/meals/saved → GET /meals?saved`; `PATCH /api/meals/:id/saved → POST`/`DELETE /meals/:id/saved`; `POST /api/meals/clone → POST /meals/:id/clones`. Read this for the rationale; ADR 0012 for the current contract.

A Member "saves" a Meal by toggling a bookmark on the existing `meal` row — there is no separate `saved_meal` table. The state lives in a single nullable timestamp column `meal.saved_at` (non-null ⇒ saved). Editing a saved Meal is editing the underlying source Meal; there is no parallel edit surface. Re-logging from a saved Meal creates a brand-new `meal` row that **clones** the source's `ai_analysis`, `override`, and R2 photo bytes, timestamped `now` (or a Member-chosen Day). The clone and the source are wholly independent after the clone — deleting either does not affect the other.

## Why

Two architectural pulls fought each other; we picked the simpler one in both cases.

**Marker vs. separate table.** A `saved_meal` table would duplicate `ai_analysis`/`override`/photo at save time, then require two edit surfaces (edit the Meal vs. edit the Saved Meal), two query paths, and a constant question about which copy is the truth. The marker model collapses that: the Meal log IS the saved-meals dataset, filtered. One edit surface (`/meals/:id`) does double duty.

**Re-log = clone, not reference.** The e-commerce basket analogy is exact: a basket item carries its own copy of the product's data so the order is stable even if the product changes or disappears. A re-logged Meal must show the same kcal and the same photo on its own Day even if the Member later deletes the source. Sharing the source's `photoR2Key` and refcounting was rejected — R2 server-side copy is fast and free at this scale, and independent lifecycles eliminate a whole class of cascade-delete edge cases.

## Considered alternatives

- **Separate `saved_meal` table with its own CRUD.** Rejected — duplicate edit surfaces, drift between source and saved, twice the API + UI surface for no behavioral gain.
- **Saved-state stored as `override.name`** (combining marker + custom name). Rejected — conflates the "saved for re-log" intent with a generic display-name override; surprising side effects when a Member just wants to rename a logged Meal without declaring it a template. Kept `override` as totals-only, lifted the marker into a dedicated column.
- **Boolean `is_saved` column.** Rejected in favor of `saved_at` timestamp — the timestamp gives us "most recently saved" ordering on the Profile list for free, and a future "saved-at vs created-at" delta if we ever want it.
- **Re-log by reference (share R2 key + refcount on delete).** Rejected — adds refcount complexity and a delete-cascade gotcha for no real benefit at v1 scale (10 GB R2 free tier covers years of re-logged oats).
- **Re-log via `POST /api/meals` with a `sourceMealId` alternative body.** Rejected for clarity — the photo-upload path and the clone path have different inputs, different validation, and different code; separating into `POST /api/meals/clone` keeps each endpoint single-purpose.
- **Custom names editable in v1.** Deferred to v2 — the bookmark toggle is a single tap; introducing a name-prompt sheet would multiply the interaction cost. v1 saved Meals display `aiAnalysis.dishName`; rename hooks into `override` (or a dedicated column) in v2 if Members ask.

## Consequences

- **Schema:** new column `meal.saved_at integer mode timestamp` (nullable). Index `(user_id, saved_at)` with a partial filter for the Profile list query.
- **Endpoints:**
  - `GET /api/meals/saved` — saved-meals list (`WHERE saved_at IS NOT NULL ORDER BY saved_at DESC`).
  - `PATCH /api/meals/:id/saved` — toggle; body `{ saved: boolean }` or no body (server flips current state).
  - `POST /api/meals/clone` — body `{ sourceMealId, capturedAt? }`. Copies source row's `ai_analysis` + `override` into a new row; R2 `BUCKET.put` of the copied object bytes under a new key; returns the new MealDetail.
  - `GET /api/meals/:id` projection includes `savedAt` so the detail page can render its toggle state. **List projections (`GET /api/meals`, `GET /api/meals/saved`) do NOT need `savedAt`** — saved-status is communicated by filtering (Profile section and picker sheet are saved-only by definition) and is deliberately invisible on the Day view list.
- **UI:**
  - **MealCard does NOT render a bookmark glyph in any context.** The same MealCard component is reused unchanged across the Day view list, the Profile saved-meals section, and the picker bottom sheet. Saved-status awareness lives entirely on the detail page; the lists communicate it implicitly via filter.
  - **Meal detail page header is the sole bookmark surface.** Renders a bookmark toggle (filled when `savedAt != null`); tapping it `PATCH`es. No naming sheet in v1. Saving a Meal therefore costs one extra navigation tap (card → detail → toggle) — accepted trade-off for keeping MealCard pure across surfaces.
  - Day view: the existing FAB is removed. An inline "Add" control sits at the top of the meal list (always visible, including on past days — adds with `capturedAt` anchored to the selected Day via `localDateForCapture`, identical to the existing photo-upload past-Day rule). The control is **two side-by-side buttons**: 📷 Take photo and 🔖 From saved. Both buttons are always rendered — the From-saved button never disappears or disables, even when the Member has zero saved Meals; tapping it in that state opens the picker sheet with an empty state teaching the bookmark concept ("No saved meals yet. Tap the bookmark on any meal to save it for quick re-logging.").
  - Picker bottom sheet: tapping a MealCard **clones instantly and dismisses** (no preview, no confirm). On success the sheet closes and a sonner toast confirms "Added ≈310 kcal — Oats & berries"; no Undo button in v1 (Meal delete-flow is the recovery path, currently an adjacent gap). Cloned Meal appears in the Day view list immediately.
  - Profile gets a Saved Meals section at the end of the page (reuses MealCard). Sign Out moves out of the Account section and into the Profile header's top-right, because the Saved Meals list would otherwise push Sign-Out off-screen as the Member accumulates saves (see PRD §6.11 update).
- **`aiAnalysis.dishName` is the display name.** No per-saved-Meal rename in v1. The bookmark is a single tap. Renaming, if added later, lives behind the override editor and uses a new dedicated field.
- **Editing a saved Meal mutates history.** Because the saved Meal IS the source row, changing its `override` or `aiAnalysis` (via Refinement) retroactively affects the Day on which it was originally logged. Honest framing: if you correct a saved oats Meal's portion, the Day you originally logged it gets the corrected number too — your past plan stays sealed (ADR 0002 — `profile_log` is untouched), but per-Meal totals were always derived per-read, so they update.
- **Clones do not carry the source's `saved_at`.** A re-logged Meal starts unsaved. Saving it again is a fresh action.
- **Refinement on a cloned Meal works.** Because the photo bytes are copied into a new R2 key, the existing `meals.refine()` flow runs against the clone's own photo without special-casing.
- **Honest framing intact.** No silent retroactive changes the Member didn't cause. Every state change traces to a deliberate tap (toggle bookmark, edit override, refine, log from saved).
