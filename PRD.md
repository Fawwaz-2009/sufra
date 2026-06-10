# Sufra — PRD (v0.1)

_A photo-first calorie tracker for the people at your table._

---

## About the name

_Sufra (سفرة)_ is the Arabic word for the dining table — but it means more than the furniture. A sufra is the spread of food laid out, the act of gathering people around it, the hospitality of feeding the people you love. In Arab and Middle Eastern cultures, the family sufra is a near-sacred space.

The name is deliberate. This app exists to help you stay _at_ the sufra — to keep showing up and sharing food with the people you love, while staying aware of what you're eating. It's not here to police what's on your table. It's here to make what's on your plate legible, so the choices you make at the table are yours.

The app ships in English and Arabic, with Middle Eastern cuisine as a first-class citizen in food recognition. But you don't need to be Arab to have a sufra — every household has a table.

---

## 1. Problem

Awareness of calorie intake is one of the highest-leverage habits for weight management. Once someone can see "this slice of pizza is 200 kcal," the decision changes — not because they've learned a fact, but because the cost is now legible at the moment of choice. That's the lever.

Commercial AI calorie apps (Cal AI, SnapCalorie, Lolo, Foodvisor, etc.) deliver this awareness, but they operate under per-user economics that force aggressive token efficiency: small vision context, single-pass estimation, no clarification round-trips. The accuracy ceiling that creates is structural, not technical. For most users this is fine — they want directional awareness, not precision. But for someone running a modest 10–15% deficit, an estimation error of 30%+ on a meal can quietly close the deficit and stall progress. The user can't tell whether the app or their adherence is the problem.

The open-source landscape has not closed this gap cleanly. SparkyFitness goes wide (water, sleep, mood, exercise, fasting, body metrics) and becomes overwhelming for non-technical household members. caloriemate goes narrow (calories + protein, single user, free-text retry instead of structured clarification). Database-driven apps (OpenNutriTracker, Food You, Waistline) avoid the AI accuracy problem by passing friction back to the user — every meal is a search-and-pick exercise, fine for packaged food but tedious for home cooking.

The opening: a host-deployed, host-paid-inference architecture removes the per-user cost constraint. That budget can be spent on bigger vision models, structured uncertainty, and targeted clarification — turning calorie estimation from a black box into something the user can interrogate and correct.

---

## 2. Target User

The product has two distinct users, and both need to be designed for explicitly.

**The Host.** Technically capable: comfortable with command-line tooling, has a Cloudflare account, can manage API keys. Deploys an instance once, provisions accounts for the people they care about (typically family or close household), and is the de facto support team if anything breaks. Wants minimal ongoing maintenance, no recurring billing infrastructure, no email server. Examples: a parent setting up Sufra for their household; a friend running an instance for a small group; a developer running it for themselves and a partner. In the spirit of the name, the host is exactly that — the person inviting others to their table.

**The End User.** The person whose food gets photographed. Low-to-moderate IT prowess assumed — could be a parent, a sibling, a partner, a teenager. They never see the deployment, never enter an API key, never read a config file. They install a PWA on their phone, sign in with credentials the host gave them, and from that moment forward the app is just "the food app." Their mental model is: take photo → see number → move on. They should never need to understand that there's a server or an LLM behind it.

Members are explicitly assumed to span languages. Many will not use the app at all if it's English-only. **v1 ships English-only as a scope cut; multi-language UI (Arabic first) is v2 work** (see §6.10 + §10 #14). The cultural framing the product carries in v1 lives in Middle Eastern cuisine recognition by the LLM — eval-verified — rather than in UI strings.

---

## 3. Non-goals

In v1 and likely permanently:

- No exercise / workout / step tracking
- No water, sleep, mood, fasting, or supplement tracking
- No social features (sharing, following, leaderboards, friends)
- No native iOS or Android apps — PWA only
- No multi-tenant SaaS hosting; every instance is host-deployed
- No email infrastructure of any kind (no magic links, no password reset emails, no verification, no notifications)
- No barcode scanning
- No recipe management or meal planning
- No grocery list integration
- No subscription, ads, telemetry, or analytics phoning home
- No notifications of any kind in v1. PWA push is unreliable enough on both iOS (service worker restart issues, no background wake, ~16% opt-in) and Android (OEM battery optimization queues notifications until unlock) that scheduled reminders can't be relied on. If notifications become important enough, the right move is the Expo wrapper escape hatch, not investing in PWA push.
- No support for alternative deploy targets (no Railway, Fly, Docker, VPS); architecture is Cloudflare-native
- No alternative database backends; D1 only

Deferred but possible later:

- Streaks (with salvage-day mechanic — 1 free miss per month)
- Household-shared meals (one user logs kabsa, others in the household can opt to log the same meal without re-photographing — explicit per-meal sharing, never automatic)
- Additional languages beyond English and Arabic (translation files only, no code changes needed)
- Local LLM provider via Ollama (interface accommodates it)
- iOS/Android wrappers via Expo or Capacitor if PWA limitations bite
- Barcode scanning
- Voice input as a second modality
- CLIP / embedding-based meal matching

---

## 4. Positioning

The product sits between the over-built and the under-built ends of the open-source space.

| Project                     | Scope                                                 | AI photo                 | Multi-user             | Uncertainty UX                                 | Distribution            |
| --------------------------- | ----------------------------------------------------- | ------------------------ | ---------------------- | ---------------------------------------------- | ----------------------- |
| MyFitnessPal / Cal AI       | comprehensive                                         | yes, cost-constrained    | SaaS                   | single number or none                          | native app              |
| SparkyFitness               | comprehensive (food + fitness + water + sleep + mood) | yes                      | yes                    | none                                           | self-host, web          |
| caloriemate                 | calories + protein only                               | yes                      | single user            | free-text retry                                | self-host, web          |
| OpenNutriTracker / Food You | nutrition (DB-driven)                                 | no                       | single user            | n/a (precise lookup)                           | mobile native           |
| **Sufra**                   | calories + macros + key nutrients + weight            | yes, host-paid inference | yes (host-provisioned) | structured confidence + targeted clarification | Cloudflare-deployed PWA |

Four positioning claims the rest of the PRD has to deliver on:

**Estimation that's interrogable, not opaque.** Every calorie estimate exposes a single confidence indicator to the user. Tapping it surfaces the specific things the model is uncertain about (e.g., "is the sauce oil-based?", "is this ~1 cup or ~1.5 cups?") and the user can answer just those questions to tighten the estimate. Internally we model component uncertainties (identification, portion, recipe) and combine them; externally we show one confidence value plus targeted clarifications. This is the load-bearing differentiator and the chief technical risk.

**Honest framing as a design principle.** Following the pattern of ChatGPT's "AI can make mistakes" disclaimer, every estimate is presented as an estimate, not a fact. Meal cards carry a confidence chip. We're explicit about uncertainty at the meal level, but daily totals remain clean integers so the calories-remaining number stays useful.

**Minimal surface, designed for non-technical end users.** The PWA has roughly five screens: camera/log, today's view, meal detail with clarification, history/trend, settings. No tabs the end user doesn't need. No settings the host hasn't pre-configured. Anything technical (API keys, model selection, user provisioning) lives in a host-only admin area that end users never see.

**A specific table, not a generic database.** Sufra is shaped by a particular culture. Middle Eastern, Levantine, and Gulf cuisine are first-class citizens in food recognition — kabsa, fattoush, mansaf, koshari, hummus get identified well, not approximated as "rice with chicken." The empty state sample meals lean that way. The icon language draws from a familiar visual world. Non-Arab users are welcome at the sufra; we just don't pretend to be culturally neutral. This is also a real moat — every other entrant is generic.

**Privacy via deployment, not via promise.** The host owns the Cloudflare account, the D1 database, the R2 bucket, and the OpenRouter API key. Nobody comes to your sufra without being invited. OpenRouter's zero-log routing means meal data doesn't persist with any upstream LLM provider. No SaaS middleman, no shared infrastructure with strangers, no recurring cost in the common case (Cloudflare's free tier covers a family-sized instance indefinitely).

---

## 5. Goals

The PRD should be judged against these outcomes, not against feature count.

1. **Awareness.** An end user, after using the app for two weeks, can answer "roughly how many calories was that meal?" before logging it, with materially better accuracy than at week zero. The app's job is to build that intuition until the user can mostly do without it.
2. **Trust.** Users believe estimates are reasonable _because_ the app is honest about what it's unsure of, not despite it. A user who corrects an estimate sees the correction reflected in the next similar meal.
3. **Effortlessness.** Logging a meal — photo to confirmed entry — takes under 15 seconds in the common case. If logging takes longer than eating a snack, adherence collapses.
4. **Deployability.** A host with a Cloudflare account and an OpenRouter API key can deploy a working Sufra instance via `wrangler deploy` in under 10 minutes, with no infrastructure decisions to make.
5. **Onboardability for end users.** A non-technical end user, handed a URL and credentials by the host, can install the PWA and log their first meal in under 2 minutes with no help.

---

## 6. Core Features (v1)

### 6.1 Auth (host and members)

Shared login form, role-based routing after authentication. Same URL for both roles; the server determines where to send each post-login.

**Identity / person split (ADR 0010).** Better Auth's credential table is renamed `identities` and split from an app-owned `users` person table that **shares the same primary key** — one id per human, the universal ownership anchor every resource references as `userId`. `role` / `banned` / `username` live on `identities` (the credential — Better Auth's lifecycle); the `users` row is the thin Member-as-person aggregate root (`id`, `createdAt`, `updatedAt`) that owns the Member's `profile_snapshots` + `weights` collections (§6.7, ADR 0011). "Onboarded" is **derived** from "has ≥1 profile_snapshot," not a column. A `user.create.after` hook provisions the `users` row idempotently (`INSERT OR IGNORE` on the shared id). The request-scoped `CurrentUser = { id, username, role }` is the bridge controllers read; the app SELECTs `username` from `identities` read-only by the shared id, never mirroring it.

**Grafana-style provisioning, no email.** Better Auth runs on the **Kysely-D1 dialect** (the Drizzle adapter is dropped); sessions live in **Cloudflare KV** (`secondaryStorage`, `Math.max(ttl, 60)` clamp) to avoid D1 read-after-write login flicker; the instance is built once per isolate (cached at module scope — reverses the old per-request `createAuth`). Setup creates the first Host; the Host provisions Members by username; no email anywhere. The `username` + `admin` plugins are retained.

**First deploy (Setup wizard).** Worker comes up, D1 has zero users. First visit triggers a 2-step wizard. Step 1 — host names the Sufra ("What do you call your sufra?", free-text up to 40 chars, live preview "the {family_name} Sufra"). Step 2 — host picks a username and a password (min 6 chars). Submit creates the host record with `role = 'host'`, initializes `app_settings`, sets a session cookie, redirects to Day view. The wizard only ever runs when zero hosts exist.

**Provisioning Members (Password link flow).** Member-create stays pure — it creates the `identities` row (`role = 'member'`) + the provisioned `users` person row and returns the member, nothing else. The Password link is a separate app-domain aggregate (`domain/password-link.ts` with `issue` / `show` / `redeem`), **not** baked into the Better Auth instance (the BA config stays delivery-free — nothing is delivered; the Host hands the link over out of band). From admin, the host types a username and clicks Add, then issues the link via the member's singular `password-link` sub-resource — `POST /admin/members/:id/password-link` (create = issue/regenerate; first-issue and reset are the same path; optional `DELETE` = revoke). `issue` writes a `password_link` row (opaque base64url token, 24h TTL, UNIQUE on `userId`) and returns the token. The client immediately copies a pre-baked share message to the clipboard — `"Hi {username}, here's your link to join Sufra:\n{url}"` — and toasts a confirmation that surfaces the 24h expiry. Host pastes the message wherever (WhatsApp, iMessage, group chat). No email is ever involved. The Member sets their own password at the link page; the Host never knows it.

**Password link page.** The friendly `/set-password/<token>` is the PAGE (presentation); the resource is the public token-addressed `password-links`. Unauthenticated. `GET /password-links/:token` validates the token + TTL and returns `{ username, familyName }` (404 if invalid/expired), greeting the Member with the family-Sufra name + username; the page prompts for a password (6+) and a confirmation. On submit, `POST /password-links/:token/password` writes the password hash via better-auth (internal hash + `updatePassword`), consumes (deletes) the `password_link` row, signs the Member in (set-cookie), navigates to Day view. The page sets a `noindex,nofollow` meta tag — the link is a credential, not a discoverable page. On invalid / expired token, shows a stub page telling the Member to ask the Host for a new link. See ADR 0016.

**Member first sign-in.** Password link → form submitted → "Add to Home Screen" prompt with platform-specific instructions → onboarding flow (when M2 lands) → Day view.

**Steady-state.** httpOnly cookie carries an opaque session token, validated against the KV session store on every request. 90-day rolling expiry, configurable.

**Password reset.** Same mechanism as invite — the same `POST /admin/members/:id/password-link` path. Host clicks the 🔑 icon on an existing Member's row → fresh `password_link` issued (UPSERT replaces any prior one) → message copied to clipboard. Member sets a new password at the link; their old password keeps working until they redeem. "Invite" and "reset" are the same operation in the data model; only the underlying account state differs.

**Host forgets their password.** Broken-glass recovery: a `wrangler`-callable admin endpoint gated by a deploy-time secret. Documented in the README. Ugly but honest about what no-email means.

**Deactivation.** Not modelled. Hosts delete-and-destroy Members instead — cascade removes their meals, photos, weights, profile, sessions, account row. `inference_run` rows survive (audit log is decoupled from the entities it describes — see CONTEXT.md "Password link" / earlier ADRs).

**Brute-force protection.** Per-username and per-IP rate limiting with progressive lockout. Cloudflare's built-in rate limiting as a second layer.

**Storage.** Auth tables are managed by better-auth on the Kysely-D1 dialect (with the `username` + `admin` plugins, no email): `identities` (id, username, role, banned, createdAt, …), `account` (holds the scrypt password hash), `verification` (unused but created by the library); sessions live in Cloudflare KV, not D1. The app owns the `users` person table (id shared 1-1 with `identities`, createdAt, updatedAt) as the Member aggregate root — its `profile_snapshots` (append-only; renamed from `profile_log`) and `weights` (`weight_log`) collections hold body metrics, goal, and activity (no `user_profile` table; ADR 0011). Password links live in `password_link` (id, userId UNIQUE, token UNIQUE, createdBy, createdAt, expiresAt; cascades on user delete) as their own app-domain aggregate (ADR 0016).

### 6.2 Onboarding (Member, first launch)

Six screens, one question each, ~60 seconds for a motivated Member. Universal — runs once per account including the Host. Triggered when the account has no `user_profile` row. **Step-by-step is deliberate**: mobile-first, one focused tap per screen, no dense forms; matches modern onboarding patterns (Cal AI, MacroFactor, Cronometer).

The screens, in order:

1. **Sex** — three chips (Male / Female / Other). Used in the Mifflin-St Jeor formula.
2. **Birthday** — date input (`YYYY-MM-DD`). **Not "age"** — we store the birthday and recompute age dynamically each time we run the BMR formula, so the Member's numbers stay correct as years pass without anyone needing to edit a profile field.
3. **Height** — number input, default cm. Display unit toggle (cm / ft+in) lives on the profile; storage is always cm.
4. **Weight** — number input, default kg. This is the Member's starting weight; saving also creates the first `weight_log` entry.
5. **Activity level** — four-option radio with inline definitions (Sedentary, Light 1-3 days/week, Moderate 3-5, Active 6-7). Maps directly to Mifflin's activity multipliers (1.2 / 1.375 / 1.55 / 1.725).
6. **Your goal** — chip-based selector. Each chip shows a goal direction (Lose moderately / Lose slowly / Maintain / Gain slowly), its weekly rate (~0.5 / ~0.25 / 0 / ~0.25 kg/week), AND the computed daily target it produces. Member picks the chip that matches their intent; the kcal target is derived, never directly entered.

**Why chip-based goal selection (not direct kcal input):** during this design phase we explored letting Members type a target kcal directly — rejected because (a) most non-technical Members don't know what number to pick, (b) the math should be a single direction of flow (inputs in, derived numbers out), (c) having both a chip selector AND a kcal override creates UI complexity around override states that the household audience doesn't need. See "user intent is sacred" architectural intent in §10 for the v2 customization model.

After the last step the Member lands in Day view, empty state, with a prominent capture button.

**Persisted on completion**: `user_profile` row with sex/birthday/heightCm/weightKg/activityLevel/goal/weeklyRateKg/maintenanceKcal/targetKcal/onboardedAt. First `weight_log` entry. `maintenanceKcal` and `targetKcal` are denormalized caches — the source of truth is the input fields + the formula. Any input change recomputes both.

The language picker that was Step 0 of this flow is **deferred to v2** (see §6.10 and §10).

### 6.3 Meal capture (photo-first)

Default action on opening the app is to take a photo. Capture screen has one prominent shutter button and one secondary "pick from library" action. After capture, the Worker calls OpenRouter with the vision prompt and structured-output schema — the photo is written to R2 only after the model succeeds, so failed estimates leave no orphan storage. A skeleton state shows during inference (~3-5 seconds typical). Result card displays: a dish name (the model's read of what this meal is), estimated calories, macros (protein/carbs/fat), and a confidence chip (High / Medium / Low). _(R2 is accessed via authenticated Worker routes, not S3 presigned URLs — same security stance, simpler implementation.)_

**Estimate display rule (load-bearing for honest framing):** all numeric totals shown to the user are derived from the per-food breakdown — `kcal = sum(foods[i].estimatedKcal)`, same for protein/carbs/fat. The AI's per-food numbers are *immutable* once produced and rendered as muted, non-editable reference text labeled as the AI's estimate. The user cannot edit the AI numbers directly; they can only override the resolved totals (see below). The original AI estimate remains visible even after override.

**User override.** Each top-level total (kcal, protein, carbs, fat) has an optional user-set override stored separately on the meal record. The displayed total resolves as `override.kcal ?? sum(foods.kcal)` etc., per field. Overriding never mutates the AI snapshot.

Key nutrients (fiber, sugar, sat fat, sodium) are deferred to v2 — calorie + macro accuracy is the v1 priority.

### 6.4 Structured confidence and clarification

Internally, the estimate decomposes into two components: food identification and portion size. Per-evals, portion is the dominant error source (~50% accuracy on bare photos vs ~85%+ identification). The model reports an overall confidence (high/medium/low). Tapping the confidence chip opens a clarification view listing the model's uncertainties as questions ("Closer to 1 cup or 1.5 cups?", "Is there ~1 tbsp of olive oil or more?"). Questions are biased toward **portion disambiguation**, not identification, because that's where the headroom is. User answers any subset; the estimate re-computes with answers as added context. Free-text additional context is available as a fallback. Clarifications are capped at 2–3 rounds per meal to bound inference cost.

**Two correction paths, distinct:** clarification (above) refines the AI estimate by giving the model more context; user override (§6.3) bypasses the AI estimate entirely with a manual value. Clarification updates the per-food breakdown; override only adjusts the resolved top-level totals.

### 6.5 Saved meals

**Saving is a marker on the existing Meal row, not a separate copy.** Members tap a bookmark in the Meal detail page header to flag a Meal as saved; tap again to unsave. MealCard itself carries no bookmark glyph in v1 — saved-status is communicated by filtering (Profile / picker sheet) and is invisible on the Day view list. The state lives in `meal.saved_at` (nullable timestamp). One column, one truth, one edit surface. See **ADR 0008** for the full rationale.

**Editing a Saved Meal IS editing the source Meal.** Members navigate from the Profile's Saved Meals section into the existing `/meals/:id` page — same UI, same `PUT`/`DELETE /api/meals/:id/override` (set / reset) and `POST /api/meals/:id/refinement` endpoints. This means correcting a Saved Meal's Estimate or Override **retroactively updates the Day on which it was originally logged**. Per-Meal totals were always derived per-read (ADR 0003), so the change propagates naturally. Past Day Targets stay sealed (ADR 0002 — `profile_log` is untouched).

**Re-logging clones the source Meal in full** (the e-commerce basket pattern): a brand-new `meal` row is inserted with `ai_analysis` and `override` copied from the source, `captured_at = now` (or the selected Day), and the source's photo R2 object copied to a new key under the new Meal. Clone and source are independent thereafter — deleting either does not affect the other. The cloned Meal starts unsaved (no inherited `saved_at`). Bypasses AI inference.

**Refinement on a cloned Meal works** without special-casing: the clone has its own R2 photo bytes, so the existing `meals.refine()` flow runs against them like any other Meal.

**The AI never sees Saved Meals** — matching is a pure data-layer concern, not a prompt-injection one. (Earlier draft had implicit matching where the model was given saved meal names mid-analysis; dropped because it added prompt cost forever and produced non-deterministic suggestions that were hard to debug.)

**No custom names in v1.** Saved Meals display `aiAnalysis.dishName`. Rename is deferred to v2 — keeping the bookmark a single tap was load-bearing for the "log a usual meal in 2 seconds" goal.

**Cloned Meals are indistinguishable from freshly-photographed Meals in the UI** — same universal `~` kcal prefix every MealCard already carries, no special marker, no back-link to the source row. Once cloned, the new Meal IS a regular Meal log; there is no lineage tracking ("show all clones of this Meal" is not a v1 query path).

**Endpoints (reified per ADR 0012 — non-CRUD verbs become noun sub-resources of the Meal):**
- `GET /api/meals?saved` — the saved list is a scope on the meals index (`saved_at IS NOT NULL`, ordered DESC).
- `POST` / `DELETE /api/meals/:id/saved` — the singular `saved` sub-resource (`Meal.save` / `Meal.unsave`; 204 both). Replaces the old toggle.
- `POST /api/meals/:id/clones` — the plural create-only `clones` sub-resource (`Meal.clone`; 201 + the new independent Meal). Body `{ capturedAt? }`. The result is a first-class Meal managed via `/meals` — there is no retained `clones` collection to `show` or `destroy`.

### 6.6 Day view + Week strip + Day summary panel

Day view defaults to today, swipeable to prior days. "Today" follows the user's current location — when they travel, the day boundaries shift with them. Structure top-to-bottom:

1. **Date header** with prev/next navigation.
2. **Week strip** — 7 dots showing recent days. Green = within target (including under), Yellow = 0–15% over, Red = >15% over. Trajectory at a glance.
3. **Day summary panel** — see below.
4. **Meals list** — the day's meals, each tappable to refine or edit. The **first row of the list is an inline "Add" control** — two side-by-side buttons: 📷 Take photo (camera capture, existing flow) and 🔖 From saved (opens a bottom sheet listing the Member's saved Meals as MealCards; tapping one clones it instantly onto this Day per §6.5 and dismisses the sheet). Both buttons are always rendered, even when the Member has zero saved Meals — in that state, tapping From-saved opens a sheet with empty-state copy teaching the bookmark concept ("No saved meals yet. Tap the bookmark on any meal to save it for quick re-logging."). The inline position replaces the global FAB — adds are scoped to the *selected* Day, which is obvious from where the control sits. The Add control is visible on past Days too; backfilling a Meal to yesterday is a legitimate use, and the inline position makes "adding to *this* Day" self-evident.

**Day summary panel** sits between the week strip and the meals list. Two-zone layout:

- **Left zone — calorie ring** showing kcal remaining as the default reading (`Target − sum(today's resolved kcal Totals)`). **Tap to toggle** to "consumed" view (`sum(today's resolved kcal Totals)`); choice persists in `localStorage`.
- **Right zone — three macro bars** (protein, carbs, fat) with `eaten / goal` labels and visual fill. Goal values derive from `daily_target × {0.25, 0.50, 0.25}`. Source: U.S. Dietary Reference Intakes — Acceptable Macronutrient Distribution Ranges (Institute of Medicine, 2005); the 25/50/25 split sits mid-range across all three macros. See §6.11 for the in-app explainer.

The panel exposes a small ⓘ that links to `/how-it-works`.

**Key nutrients (fiber, sugar, sat fat, sodium) are NOT displayed in v1.** The original mockup ([deviation note]) had a card showing fiber/sugar/sodium values; this is deferred to v2 alongside the `MealAnalysis` schema extension that adds these per-food values and the eval pass verifying model accuracy on them. Per §6.3, calorie + macro accuracy is the v1 priority.

**Macro display targets are derived, never persisted.** When the Member edits any input that affects their daily target (weight, activity, goal, etc.), the macros update automatically because they're recomputed from `target_kcal × split` at every read. No background recalc job, no stale cache. See §6.11 for the propagation model.

### 6.7 Weight tracking + maintenance refinement

**Weight is captured two ways**, both writing to the `weight_log` table:

1. **Profile edit.** Updating the Weight field in Profile saves the new value AND inserts a `weight_log` entry timestamped now. Profile's Weight always shows the latest `weight_log` value — it's a convenience surface for the most-recent entry, not a separate field.
2. **Dedicated weight screen** (v1.5+). User can log a weight any time without going through Profile. Trend line in history. Suggested cadence weekly.

**Weight changes propagate automatically.** Saving a new weight (via either path) recomputes `maintenanceKcal` and `targetKcal` server-side, which in turn re-derive the displayed macro goals on next read. Member doesn't need to touch their goal — the formula self-corrects as the input drifts. This is **load-bearing for honest framing**: the Member should never be eating against a stale target because the system forgot to update.

**Maintenance refinement loop (v1.5+).** After ~4 weeks of weight + intake data, the app surfaces a maintenance refinement suggestion: "Based on your logging, your actual maintenance looks closer to 2,050 kcal than the 2,200 we estimated. Update?" Refinement requires user confirmation — we don't silently move the target. The Mifflin formula is a *starting point*; the Member's actual data is the truth, and the refinement loop closes that gap. See §6.11 for the in-app framing.

### 6.8 History and trends

Past days scrollable. Weekly/monthly chart of intake vs target. Weight trend. Macro composition over time. No AI-generated commentary in v1.

### 6.9 Host admin

Separate `/admin` route accessible only to `role = 'host'`. Reached from a bottom nav tab visible only to the Host.

- **Inference cost view.** Sum of `inference_run.cost_usd` for the current calendar month (Host-TZ-resolved client-side, server takes a UTC range — same pattern as the Day view). Shows total, ~per-Member average, run count. Computed locally from per-call accounting at the rates we know about; not a reconciliation with OpenRouter's bill.
- **Vision model selection.** Radio list sourced from the `MODELS` const (single source of truth, isomorphic module imported by both worker and SPA). Instant commit on radio click. The OpenRouter API key is **not** in the admin UI — it's a Cloudflare secret set via `wrangler secret put OPENROUTER_API_KEY` and rotated the same way. Keeps the key out of the database and out of any UI surface.
- **Members.** Single list. Each row: username + 🔑 (Copy password link) + 🗑 (Delete). Add-Member form at the top (username only); submit creates the Member + a Password link in one shot and copies the share message to the clipboard. Delete uses a typed confirm dialog and removes the Member's account, meals, photos, weights, and profile via cascade. `inference_run` rows survive (audit-log decoupling).
- **Instance settings.** Family-Sufra name (the value entered during Setup, editable here).
- **Optional deficit safety bounds toggle** (deferred polish).

Members have no path to this surface — the Admin tab in the bottom nav is rendered only when `CurrentUser.role === "host"`, and the `/api/admin/*` resources are host-scoped by a `HostOnly` gate that **404s** (not 403s) for non-hosts regardless of client state. Authorization is uniform 404 scoping throughout Sufra — role is just another scoping predicate, a miss never leaks existence (visibility == capability; see ADR 0013).

### 6.10 Localization — DEFERRED TO V2

Multi-language UI is **deferred to v2.** v1 ships English-only.

**The positioning claim still holds.** Sufra's "specific table, not a generic database" claim (§4) was always carried by **Middle Eastern cuisine recognition in the LLM** (kabsa, fattoush, mansaf identified correctly, not approximated as "rice with chicken") more than by UI language. That part is intact and eval-verified. The estimator's `locale` plumbing already exists (Locale type, `getSystemPrompt(locale)`) and is exercised in evals — production calls it with `locale: "en"` hardcoded. Adding Arabic UI in v2 is a translation pass and an RTL stylesheet flip, not a refactor: the codebase keeps using logical CSS properties (`ms-*` / `me-*` / `text-start`) as a free habit so v2 doesn't need a sweep.

**What v2 will add.**

- React-i18next setup with lazy-loaded JSON locale files
- Arabic translation pass for all UI strings, error messages, onboarding copy
- RTL verification on real device
- Language picker as Step 0 of onboarding
- `userProfile.language` and `userProfile.numeralSystem` columns (schema retains these as dead columns in v1; v2 starts populating them)
- `app_settings.default_language` activated (Host-set default for new accounts)
- Eastern Arabic numerals as a per-Member toggle

**The name stays.** Sufra remains an Arabic word; the "About the name" section is intact; the icon language and cuisine recognition carry the cultural framing in v1.

### 6.11 Profile + "How does this work?" explainer

**Profile page** is the per-Member surface for body metrics, goal, account, and saved Meals. Universal — every signed-in account sees it. Sections, top to bottom:

- **About you** — sex (chip), birthday (date), height (number + unit), activity level (radio). **All editable** via the iOS-Settings sheet pattern. Weight is logged through the shared Log Weight sheet (also reachable from Progress); see PRD §6.7 + ADR 0007.
- **Goal** — current goal label + rate (e.g. "Lose moderately · ~0.5 kg/week"). A "Change" button opens a sheet with the goal-weight slider + rate chips (mirrors Onboarding's last screen).
- **Your numbers** (read-only) — Daily target, Protein, Carbs, Fat. Macros derived live from `target_kcal × {0.25, 0.50, 0.25}`.
- **How does this work? →** link to `/how-it-works`.
- **Account** — Username (read-only). Sign Out is *not* here in v1 (see below).
- **Saved Meals** — at the very end of the page. Renders the Member's saved Meals as MealCards (reuses `<MealCard>` from the Day view, filtered by `saved_at IS NOT NULL`). Tapping a card navigates to `/meals/:id` — there is no separate saved-meal edit surface. See §6.5 + ADR 0008.

**No customization of target or macros in v1.** Members cannot manually override the computed target or per-macro grams. This was a deliberate design choice: editable derived values create coupling problems (changing weight should ripple to target should ripple to macros — but if any of those are locked, the propagation breaks confusingly). v1 keeps a single direction of flow: inputs → derived numbers, always. See §10 for the v2 "user intent is sacred" customization model.

**Sign-out lives in the Profile header's top-right corner** (icon button). This is a deliberate reversal of an earlier rule that put Sign-Out in the Account section body. The reason is the Saved Meals section: as a Member accumulates saves, the section grows and pushes any body-anchored Sign-Out off-screen. Keeping Sign-Out in the header keeps it reachable at one tap regardless of how many saved Meals the Member has. The earlier concern ("nobody signs out of their food app daily, putting it in chrome is loud") is acknowledged — but the day-view-header version was the louder placement; a small icon in a Profile header (a page that already concerns account state) is a tolerable cost for the always-reachable property.

**"How does this work?" explainer page** at `/how-it-works` — a single static route, accessible from Profile and from the ⓘ on the Day summary panel. Explains, in plain English with citations:

1. **BMR (Mifflin-St Jeor formula).** Why we use it, the equation, the activity multipliers. Citation: Mifflin, M.D. et al. (1990). _A new predictive equation for resting energy expenditure in healthy individuals._ American Journal of Clinical Nutrition, 51(2), 241–247.
2. **Target kcal.** How we derive it from maintenance and the chosen rate. The "1 kg fat ≈ 7,700 kcal" approximation.
3. **Macro split.** 25% protein / 50% carbs / 25% fat as a middle-of-the-window pick within the Acceptable Macronutrient Distribution Ranges. Citation: Institute of Medicine (2005). _Dietary Reference Intakes for Energy, Carbohydrate, Fiber, Fat, Fatty Acids, Cholesterol, Protein, and Amino Acids._
4. **When numbers change.** Whenever an input changes, everything downstream recomputes. The math stays consistent; there's no parallel state to drift.
5. **Calibration over time (v1.5+).** The Mifflin formula is a starting point; after ~4 weeks of weight + intake data, Sufra compares predicted vs actual progress and suggests an updated maintenance number if reality diverges.

Closing copy carries the honest framing: "For specific goals or medical conditions, talk to a registered dietitian. Sufra makes choices legible — it doesn't make recommendations."

**Why no smoothing / adaptive targets in v1** (Cal AI / MacroFactor pattern): apps that adjust the daily target based on prior-days' actuals create opacity ("why is my target 1,700 today and 2,000 tomorrow?") that contradicts Sufra's honest-framing principle. The Member should know what they're aiming for each day. If a Member wants adaptive smoothing in v2, it'll be an explicit opt-in with a "How is today's target derived?" tooltip on the Day view — not silent app behavior.

---

## 7. User Stories

**Host stories**

- _As the host, I can deploy Sufra with `wrangler deploy` and an OpenRouter key, and have a working instance behind my own URL within 10 minutes._
- _I can create an account for my partner, hand them a URL and login, and they can use Sufra without me explaining anything._
- _When my mother forgets her password, I can reset it from the admin panel in two clicks — no email round-trip._
- _I can see roughly how much inference cost my instance has incurred this month, so I can decide if I need to change models._

**End user stories**

- _I open the app, photograph my lunch, see "~580 kcal, medium confidence," and either accept it or tap the confidence chip to answer two questions that tighten the number — all within 20 seconds._
- _When I eat my usual oats, I can tap a saved meal instead of taking a photo, and I still see that the estimate is approximate._
- _I can log my weight on Sunday morning and see whether my actual progress matches what the app projected._
- _After a month of logging, the app tells me my real maintenance seems different from the original estimate and asks if I want to adjust my target. I say yes (or no) and continue._
- _I can swipe back to yesterday to remember what I ate, and see at a glance whether last week trended green or red._

---

## 8. Architecture & Tech Decisions

> **Re-platform (ADRs 0009–0016).** Sufra's backend has been rebuilt onto the Effect + Cloudflare house style: Effect v4; `Model.Class` as the single source of truth; the `Command<A>` persistence model (`makeTable` CRUD + named Command-returning reads, `run` / `atomically`) — no ORM query builder exposed to callers; an `HttpApi` contract with thin `HttpApiBuilder` controllers; domain aggregates composed of `-able` concerns; and the layered `worker/` tree (`contract/` · `models/` · `views/` · `db/` · `domain/` · `controllers/` · `middleware/` · `auth/` · `estimator/` · `blobs/`, composed in `server.ts`). Auth runs on the Kysely-D1 dialect with KV sessions and the `identities`/`users` split (§6.1). Media is the `attachable` model served through the authenticated Worker proxy (one polymorphic `attachments` table; the meal photo is an optional `photo` slot). The frontend stays a TanStack Router SPA + PWA but adopts the typed Effect `HttpApiClient` derived from `worker/contract` — Expo-forward (the `contract`/`models`/`views` layers are browser-safe so they lift into a shared `packages/contract` when a native app lands). The Hono + Drizzle + Hono-RPC + per-request-`createAuth` description in §8.1–§8.4 below is **superseded** and retained only as the historical v1 shape.

### 8.1 Stack

- **Frontend:** Vite + React + TanStack Router + TanStack Query + vite-plugin-pwa + Tailwind + shadcn + sonner (toasts). Data seam is the typed Effect `HttpApiClient` derived from `worker/contract` (replaces the former Hono RPC client and the raw-`fetch` hatches).
- **i18n:** _Deferred to v2._ v1 ships English-only; logical CSS properties used throughout as a free habit so v2 RTL is a stylesheet flip, not a refactor.
- **Backend:** ~~Hono on Cloudflare Workers, with Hono RPC for end-to-end type safety~~ **Superseded** — Effect v4 on Cloudflare Workers; `HttpApi` contract + thin `HttpApiBuilder` controllers; `Model.Class` + the `Command` persistence model; domain aggregates of concerns (see the re-platform note above and ADR 0009).
- **Single Worker** serving both static assets (the built React bundle) and `/api/*` routes. `server.ts` is the composer; a two-seam handler routes `/api/auth/*` → Better Auth, `/api/*` → the Effect handler, else the SPA.
- **Database:** Cloudflare D1 (SQLite-compatible); schema versioned and migrated via Wrangler. The Drizzle migration baseline was nuked and reset (no data migration) — `0001_better_auth.sql` from the BA CLI + clean domain migrations (ADR 0009).
- **Storage:** Cloudflare R2 for meal photos via the `attachable` media model — one polymorphic `attachments` table, a `Blobs` transport service (`put`/`get`/`delete`), served through the authenticated Worker proxy `GET /meals/:id/photo` (no public bucket exposure; no S3 presigned URLs in v1; see ADR 0014)
- **Inference:** OpenRouter (host's key, configured at deploy); Gemini 2.5 Flash as default vision model. The estimator is an Effect service leaf the eval harness still imports unchanged.
- **Auth:** ~~better-auth with the `username` plugin (no email), `signUp` disabled; sessions in D1; scrypt hashing~~ **Superseded** — better-auth (`username` + `admin` plugins, no email) on the **Kysely-D1 dialect**, sessions in **Cloudflare KV** (`secondaryStorage`), one instance per isolate; the `identities`/`users` split (§6.1, ADR 0010); scrypt hashing (Web Crypto, no WASM)
- **Deploy:** `wrangler deploy` from the repo

### 8.2 Why this shape

> **Superseded by the re-platform note above and ADR 0009.** The Hono + Hono-RPC reasoning below is the historical v1 rationale.

TanStack Start (the SSR meta-framework) was considered and rejected. Its build pipeline currently doesn't play cleanly with vite-plugin-pwa — workarounds exist but are brittle, and SSR's value is minimal for an authenticated PWA opened from a home-screen icon. TanStack Router gives us file-based, type-safe routing without the build friction. The frontend stays a SPA (NOT Start/SSR), Expo-forward (ADR 0015). Server context (secrets, D1, OpenRouter calls) lives in Effect controllers under `/api/*` on the same Worker; the typed `HttpApiClient` bridges the seam with full type inference. _(Historically this was Hono RPC: `client.api.meals.analyze.$post(...)`.)_

### 8.3 LLM provider abstraction

Even committing to OpenRouter for v1, inference sits behind an interface so adding providers later is contained:

```ts
interface VisionProvider {
  analyzeMeal(input: MealAnalysisInput): Promise<MealAnalysisResult>
}
```

`MealAnalysisInput` carries the photo, optional user text, optional list of saved meals to consider, and any prior clarification answers. `MealAnalysisResult` carries the structured estimate.

The system prompt explicitly instructs the model to recognize Middle Eastern, Levantine, Gulf, and North African cuisine accurately — naming dishes specifically (kabsa, mansaf, koshari, fattoush, mujadara) rather than approximating ("rice with chicken"). This is part of the "specific table" positioning claim and is testable: a kabsa photo that comes back as "rice and chicken" is a regression.

### 8.4 Structured confidence — data model

Model returns JSON (simplified, actual Zod schema in `worker/meal-analysis/schema.ts`):

```ts
{
  notAnalyzable: boolean,                 // true if photo isn't food / unreadable
  notAnalyzableReason: string,            // user-read; locale-aware; empty when analyzable
  dishName: string,                       // user-read; "Kabsa", "Fruit and rice plate"; locale-aware
  foods: [{
    name,                                  // user-read; locale-aware
    portionGrams,                          // mass in grams; drives all math
    portionEstimate, portionUnit,          // human-readable display (e.g. 4 + "pieces")
    estimatedKcal, estimatedProteinG, estimatedCarbsG, estimatedFatG,
    confidence,                            // high | medium | low
  }],
  clarifications: [
    { id, question, type: "binary" | "choice" | "scale", options: [] }
  ],
  overallConfidence: "high" | "medium" | "low",
}
```

**No top-level totals.** Meal totals (kcal, protein, carbs, fat) are computed by the consumer as `sum(foods[i].field)`. Storing both per-food and top-level invites consistency bugs (LLM non-determinism can produce a top-level total that doesn't match the per-food sum); keeping per-food as the only source of truth eliminates the class of bug.

**Key nutrients** (fiber, sugar, sat fat, sodium) deferred to v2 — not in the schema today.

**No `matchedSavedMeal` field.** Saved-meal handling is data-layer only (§6.5) — the model never sees saved meals.

Clarification questions are generated by the model from its own uncertainties (biased toward portion disambiguation). The user answers any subset; answers are appended to the next inference call as additional context. We don't try to mathematically update components — we just re-ask the model with more information.

**DB persistence (M3 — landed):** the meals module stores `ai_analysis` (the model output for the current Estimate) and optional `override: { kcal?, proteinG?, carbsG?, fatG? }` (mutable per-field user corrections) per meal. The display layer resolves `override.field ?? sum(foods.field)`. The AI snapshot is **not mutated by Override**, but **is replaced in place by Refinement** — Refinement is a deliberate user action that produces a new Estimate, no history is kept (see CONTEXT.md for the canonical Override/Refinement distinction).

### 8.5 Time and day boundaries

Meals are stored with their `captured_at` as a UTC ISO Z text column (sortable; lex-comparable for range queries). The Member's timezone is *not* persisted on the meal — Day-segmentation is purely client-side based on the Member's current TZ at view time. Past meals stay anchored to the UTC moment they happened; "today" is whatever local-midnight window the client is currently in (see CONTEXT.md "Day").

Day-segmentation is a client-side concern. The server exposes range-based queries (give me meals between two UTC moments); the client decides what range corresponds to "today" or "this week" based on the user's current timezone. When the user travels, "today" follows them — Bali days when in Bali, New York days when in New York. Past meals stay anchored to the moments they happened.

This means we don't try to be authoritative about what day a meal "belongs to" in some absolute sense. We present a consistent view based on where the user is now. A traveler with a 30-hour day from crossing timezones just sees more meals in that day's record — a faithful representation rather than a forced bucketing.

Week boundaries follow the same rule. The Day view's visible week is `weekStart(selectedDay, firstDayOfWeek) .. +7d`, computed entirely on the client. The server only sees the resulting UTC range via the standard `GET /api/meals?from&to`. First-day-of-week is hardcoded Monday in v1 (matches the mockup); localizing it — per `Intl.Locale.prototype.getWeekInfo()` or a Member-level profile setting — is a pure client change with no server or schema impact (see §10 #13). This is a load-bearing property of the design: bucketing logic stays where the user's TZ lives, so culture-specific calendar conventions never become a backend concern.

### 8.6 What we're NOT building in v1

- No CLIP / embedding-based meal matching (LLM-naming is enough)
- No background jobs or queues (everything request-response)
- No analytics or telemetry
- No custom CDN config (Cloudflare defaults)
- No custom domain automation (host points their own or uses workers.dev)

---

## 9. Milestones

Scoped for ~1 week of focused work. Each milestone is end-to-end testable.

**M1 — Skeleton & deploy path (Day 1) — LANDED**
Repo with Vite + Hono single-Worker scaffolding. `wrangler deploy` produces a working hello-world. D1 provisioned with migration runner. R2 bucket provisioned. Login screen, session handling, setup wizard creates first host.
_Exit:_ host can clone repo, deploy, create admin account, log in.

**AI evaluation harness (out of milestone order) — LANDED**
`evals/` (promptfoo + Nutrition5K measured ground truth) imports from the shared `worker/meal-analysis/` module. Tests bare vs with-portion-hints variants × multiple models. Key findings: Gemini 3 Flash leads at ~78% kcal accuracy bare / ~96% with portion hints; portion is the dominant error source across all models (~50% accuracy on bare photos vs ~85%+ identification). Model rankings, prompts, and the Zod schema are now under continuous regression testing — any prompt/schema change re-runs through the eval before shipping. See `evals/RESULTS.md`.

**M2 — Onboarding & Day view shell (Day 2) — LANDED**

What landed and how the shape diverged from this PRD section's original intent (formal record in `docs/adr/`):

- **Bottom nav 2 → 3 tabs** (Today / Profile / Admin). Sign-out moved from Day header to Profile.
- **Onboarding wizard** — 6-step flow (sex / birthday / height / weight / activity / goal). Step 6 uses a **slider** for `goal_weight_kg` plus rate chips (Slowly 0.25 kg/wk / Moderately 0.5 kg/wk), not the original chip-only design. Slider range is asymmetric: `currentWeight − 60` to `+30` kg.
- **`profile_log` replaces `user_profile`** (ADR 0001). Append-only history table; "current profile" = latest row by `effective_from`. No separate current-state table.
- **Profile edits apply starting next local midnight** (ADR 0002). Today's plan is sealed from the moment the day begins — no mid-day target shifts. Uniform rule: applies to weight changes too. Onboarding is the only same-day write (Member is bootstrapping; nothing to seal).
- **Derived fields are not stored** (ADR 0003). `meal.kcal_total`, `maintenance_kcal`, `target_kcal` all dropped from the schema. `worker/profile/derive.ts` is the single isomorphic formula module computing Mifflin → Maintenance → Target → macro grams at every read; `worker/meals/totals.ts` resolves per-meal kcal/macros via `override.field ?? sum(foods.field)`.
- **Profile page** — per-field bottom sheets (iOS Settings pattern, mobile-first). Each row → sheet → in-sheet live preview using the shared formula module → save → toast "Starts tomorrow."
- **Day summary panel** — kcal ring (custom SVG, Remaining default, tap-to-toggle to Consumed via `sufra:ring-mode` localStorage) + 3 CSS macro bars (P/C/F as eaten/goal). No key nutrients (v2). Past-day-aware via `snapshotFor(profiles, day)`.
- **`/how-it-works`** — static page, Mifflin (1990) + IOM AMDR (2005) + Wishnofsky citations. Excluded from onboarding gate so wizard ⓘ icons can deep-link.
- **Sex enum collapsed to `male | female`** — Mifflin's gendered constants don't have a neutral middle. ⓘ → /how-it-works carries the explanation; no "assigned at birth" framing in the UI itself.
- **No safety-deficit floor** in v1; see §10 #6 (deferred to v1.5).

_Exit met:_ Member can complete onboarding from a Password link, land on Day view with their target visible, edit their profile, see numbers recompute live across past days via `profile_log` snapshots.

**M3 — Meal capture & analysis (Days 3–4) — LANDED**
Camera capture (or library fallback). Photo upload to R2 via signed URL. Worker calls `worker/meals/estimator/` to analyze; analysis returned for confirmation before persistence. Meal saved to D1 with both the immutable AI estimate and optional user override (§6.3). Meal card in Day view with confidence chip. Totals update; week dot updates.

**M4 — Clarification flow (Day 5)**
Tap confidence chip → clarification view → model-generated questions → user answers → re-inference → updated estimate. Original photo and clarification history retained on meal detail.
_Exit:_ end user can refine an inaccurate estimate by answering 1–3 questions.

**M5 — Saved meals (next)**
Saved meals shipped via the marker-on-existing-Meal model (no separate `saved_meal` table) and the basket-clone re-log pattern. See §6.5 and **ADR 0008** for the full data + UI shape. Concretely:
- Schema: add `meal.saved_at integer mode timestamp` (nullable).
- Backend: `GET /api/meals/saved`, `PATCH /api/meals/:id/saved`, `POST /api/meals/clone` (copies row + R2 photo to new key).
- SPA: bookmark glyph on MealCard + bookmark toggle in Meal detail header. Day view replaces the FAB with an inline "Add" control at the top of the meal list (two options: photo / from saved meal — the latter opens a bottom-sheet picker rendering MealCards). Profile gets a Saved Meals section at the very end (reuses MealCard). Sign Out moves to the Profile header's top-right (PRD §6.11 — reversal of the prior placement, see that section for the reason).
- Re-log endpoint behaviour: clone is independent of source — deleting either does not affect the other. Cloned Meal starts unsaved.
- Custom names deferred to v2.

_Exit:_ Member can bookmark a Meal, see it in Profile, and re-log it from the Day view in two taps.

**Weight tracking + Progress (LANDED ahead of M5)** — see §6.7 + the M5/M6 entry below. Shipped during the Progress-tab work.

**M6 — History, polish, deploy docs (Day 7)**
History view (past days, week/month chart). Admin polish (model selection, cost view, Members CRUD complete — all landed). README with deploy guide and "About the name" section. Add-to-Home-Screen prompt and instructions. Error states, skeletons, basic offline handling.
_Exit:_ shippable in English. Another host could deploy a fresh Sufra instance from the README alone. Arabic UI translation pass is **v2 work**, not v1 (see §6.10).

---

## 10. Open Questions & Risks

### Open questions

1. **OpenRouter zero-log claim — verified scope?** Marketing says zero log; does this apply uniformly across upstream providers OpenRouter routes to? Affects the privacy claim in README.
2. **R2 photo lifecycle.** Keep forever (default), or auto-delete after N days with host toggle? Free tier is generous but not infinite.
3. **Photo preprocessing.** Client-side resize to max 1024px long edge, JPEG q85 before upload — confirm?
4. **Vision model default.** Resolved — eval-driven. Gemini 3 Flash preview leads at ~78% kcal bare / ~96% with portion hints. `DEFAULT_VISION_MODEL_ID = "google/gemini-3-flash-preview"`, single source of truth in `worker/meals/estimator/models.ts`. Schema column default dropped; Setup wizard inserts the const explicitly. Arabic-output quality verification deferred to v2 alongside the translation pass.
5. **Maintenance refinement window.** Default 4 weeks of logging data before surfacing suggestion. Host-configurable, or fixed? Right window length?
6. **Safety floor on deficits — deferred to v1.5.** Not shipped in M2. Audience is family + open source; not a v1 blocker. Members are adults, the math runs as input → derived. If dogfooding surfaces members hitting a steep deficit unawares, revisit: soft warning above 25% deficit (Academy of Nutrition and Dietetics general guidance) + absolute floor at 1200/1500 kcal (female/male). Always soft, never a hard block — "user intent is sacred" (§10 #15).
7. **Eastern Arabic numerals as default for Arabic?** _Deferred to v2_ alongside the translation pass (§6.10). Currently planning Western (0-9) as default with Eastern as toggle. Revisit with Arabic-speaking Members once v2 lands.
8. **Domain.** `sufra.app` availability check needed. If taken, fallbacks: `sufra.dev`, `sufra.food`, `getsufra.com`.
9. **Day cutoff setting.** Default day boundary is local midnight. Some users (late-night eaters) want a configurable cutoff (e.g., 4am). Deferred to post-v1 unless real users ask; flag it here so we don't forget.
10. **Override-vs-refinement collision and refinement trace — RESOLVED in M3.5.** Both gaps closed in a single meal-detail redesign pass:

    _Collision (was):_ override-200 + refine-AI-to-300 displayed 200 stuck with no explanation. _Now:_ Override editor uses the AI value as the input's `placeholder` and a tappable `× edited` badge next to the label whenever a field carries an override. Tapping the badge clears just that field; the placeholder reveals the live AI number. Members audit by clearing, not by reading a divergence banner. Candidates (a)–(d) considered; (a)-equivalent + the per-field clear shipped together.

    _Trace (was):_ Member couldn't see what they previously told the AI. _Now:_ `meal.last_refinement_text` (nullable text, migration 0010) stores the latest Refinement input. The Improve estimate sheet prefills its textarea with that value on open, so the trace lives where the action lives — re-open the sheet to see your last note + any new clarifications. AI Estimate itself still has no history (replace-in-place per CONTEXT.md "Refinement"); only the user input is one-deep memorized. Candidate (e) shipped; (f) and (g) not needed.

    Same batch dropped the "AI: X kcal" caption from each override field (the placeholder carries that info now) and tagged all meal mutations with `mutationKey: ["meal", id]` for downstream uses (delete-button interlock).

11. **Confidence chip — RESOLVED in M3.5.** Chip removed entirely. Confidence label string ("HIGH/MEDIUM/LOW") never renders. The only surface is the **color tint of the "Improve estimate" button** next to the AI Estimate (green/amber/red by `overallConfidence`). Tapping the button opens a bottom sheet showing the model's `clarifications` list + textarea, satisfying the "any Confidence affordance must couple to the Clarifications surface" rule from CONTEXT.md "Confidence". Path (b) chosen (action-oriented affordance); the chip is gone, not deferred. MealCard list-view chip removal is a follow-up — same redesign should propagate but hasn't been swept yet.

12. **Capture failure handling — Member-delete landed, two pieces still open.** What's landed: Member self-delete via `DELETE /api/meals/:id` (hard delete with R2 cleanup in the same handler; `inference_run` rows survive; AlertDialog confirm + post-delete toast + page-level interlock that disables Delete while other meal mutations are in flight). What's open: (a) **capture-failure retry** — the spinner toast on a failed create should offer a "Try again" button on the same photo bytes (currently client just shows an error toast and drops the photo); (b) **admin-side delete** — Host removes any Member's meal (wrong photo, mis-logged session). Admin-delete should be a separate endpoint with a `role === "host"` ownership branch, not a retrofit of `DELETE /api/meals/:id`. Both before v1 ships to non-developer households.

13. **Locale-aware first-day-of-week.** v1 hardcodes Monday-start for the Day view's week strip — matches the mockup and ISO convention, simple, consistent across Members. The right v2 answer is locale-derived via `Intl.Locale.prototype.getWeekInfo()` (en-GB → Mon, en-US → Sun, ar-SA → Sat), possibly with a Member-level override stored on `user_profile`. Per §8.5, this is a pure client change — no server work and no schema migration unless a profile override is added. Revisit once Arabic Members adopt or when onboarding (M2) lands and we have a natural place to plumb the preference. If shipped, the week strip helper signature (`weekStart(date, firstDay: 1–7)`) is already parameterized for this swap.

14. **Multi-language UI (Arabic + RTL).** Cut from v1, deferred to v2. v2 work: react-i18next setup with lazy-loaded JSON locale files, Arabic translation pass, RTL verification on a real device, language picker as Onboarding Step 0, activation of dead schema columns (`userProfile.language`, `userProfile.numeralSystem`, `app_settings.default_language`), Arabic-quality LLM eval. v1's logical CSS habit (`ms-*` / `me-*` / `text-start`) was kept specifically to make this a stylesheet flip rather than a sweep. See §6.10.

15. **Nutrition customization for v2 — "user intent is sacred" architectural intent.** v1 ships with no manual override of `target_kcal` or per-macro grams: inputs flow one way into derived numbers, no locks, no `is_custom` flags. v2 will introduce customization (per-macro grams, optionally a goal-weight slider as alternative target-input mode) with a strict architectural requirement: **derived values recompute automatically when their inputs change; explicit user overrides are tagged and preserved across recomputes.** Concretely: changing weight in Profile updates maintenance (always); updates target *unless* target was explicitly locked; updates protein/carbs/fat goals *unless* one of them was explicitly locked. The schema add is three nullable columns on `user_profile` (`target_kcal_locked: boolean`, optional `protein_g_override / fat_g_override / carbs_g_override`); NULL = derived, non-null = locked. Reset-to-default UI removes the lock. The principle echoes the v1 Override vs Estimate distinction (CONTEXT.md): once the Member has made a deliberate choice, the system never silently overwrites it.

16. **Adaptive daily targets — explicitly opt-in only, with transparency, never in v1.** Some competitor apps (Cal AI, MacroFactor flavors) silently adjust the daily kcal target based on prior-days' actuals — "weekly calorie banking" — which produces values like 1700/2000/1800 against a stated 2000 goal. This is opaque from the Member's perspective and contradicts Sufra's honest-framing principle. **v1 ships a fixed daily target.** If v2 adds smoothing or HealthKit-style activity adjustments, it must be: (a) explicit opt-in in Profile, (b) accompanied by a "How is today's target derived?" tooltip on the Day view showing the math, (c) toggleable off without losing historical data.

17. **Dev-server clipboard fallback.** The modern `navigator.clipboard.writeText` API requires a secure context (HTTPS / localhost / 127.0.0.1). Production over Cloudflare is always HTTPS — no issue. Local dev served over LAN IP (e.g. `10.x.x.x:5173` for mobile testing) is plain HTTP and the modern API throws. The Members section uses a `document.execCommand("copy")` legacy fallback so the password-link copy works during phone-on-LAN dogfooding. Note: `execCommand` is deprecated; if it's removed by browsers in the future, the alternative is to run dev with the Vite Cloudflare tunnel (`t + enter`) which is HTTPS, or set up local HTTPS certs. Not a v1 blocker.

18. **Override + Refinement interaction — parked UX enhancement.** When a Refinement runs while overridden fields exist, the override-wins resolution already does the right thing (`override.field ?? sum(foods.field)` — the manual values keep showing, the fresh Estimate sits underneath). The parked enhancement is purely informational: surface a subtle inline notice on the Improve sheet listing the overridden fields — e.g. "your manual values for kcal, protein will keep showing until you reset them" — so the Member isn't surprised that a refine didn't visibly move those numbers. Pure UX; no model impact (resolution semantics are unchanged; the `× edited` badge per field from #10 already affords the reset). Deferred — flag, don't build, until dogfooding shows the confusion is real.

### Risks

1. **The structured confidence flow doesn't pan out.** Load-bearing claim of the whole project. _Mitigation:_ prototype the inference call in isolation on Day 1, before committing to UI work. If clarification questions are bad, positioning needs rethinking before we build the rest.
2. **OpenRouter cost is higher than expected.** Clarifications multiply inference calls. _Mitigation:_ measure during dogfooding, cap clarifications at 2–3 rounds per meal, document cost per logged meal upfront.
3. **PWA limitations on iOS.** Camera access, push notifications, storage eviction. _Mitigation:_ test on real iOS hardware early in M3. Document the Add-to-Home-Screen gesture clearly. Expo wrapper as v2 escape hatch.
4. **D1 is still relatively young.** _Mitigation:_ keep schema simple, hide it behind a data-access layer, swap to Turso or Neon if needed.
5. **Build it for the family, they don't use it.** The unglamorous risk. _Mitigation:_ be your own first user. Don't expand scope until two weeks of consistent personal use proves the core value.
6. **The "open source" promise creates maintenance burden.** _Mitigation:_ upfront in README that this is a personal project shared publicly, not a community-maintained one. Set expectations.
7. **Arabic LLM output quality is uneven across models.** Vision models vary in how well they handle Arabic food names, regional dish identification (Middle Eastern cuisine specifically), and clarification phrasing. _Mitigation:_ Day 1 prototype tests both English and Arabic prompts against the default model, with a specific test set of Middle Eastern dishes (kabsa, mansaf, fattoush, koshari, etc.). If Arabic output is poor on the default, document an Arabic-preferred alternative in admin model selection.
8. **Tonal drift — the name pulls warmer than the function.** Sufra is celebratory and abundant; calorie tracking is, at some level, the opposite. _Mitigation:_ hold the framing as "Sufra helps you stay at the sufra," not "Sufra helps you avoid the sufra." Any feature that sounds restrictive or shame-coded gets the name pulled out of its description as a sanity check — if it reads wrong with "Sufra" in the sentence, it's probably wrong regardless.
