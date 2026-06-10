# Sufra

Sufra is a photo-first calorie tracker that one technically-capable Host deploys to their own Cloudflare account and shares with the household Members eating at their table. It exists to make calorie awareness legible to non-technical Members without per-user SaaS economics constraining estimation accuracy.

## Language

**Host**:
The technically-capable person who deploys a Sufra instance to their own Cloudflare account, configures it, and provisions accounts for the household. Holds the OpenRouter key, sees the admin surface, eats too. Schema role: `host`. There is exactly one Host per instance.
_Avoid_: Admin, owner, operator.

**Identity**:
The Better Auth credential row (`username`, `role`, `banned`) — the login, not the human. Owned by Better Auth via the Kysely-D1 dialect; table renamed `identities`. Shares its primary key with the Member's `users` row, so one id anchors both the credential and the person.
_Avoid_: user (the table), account, login.

**Member**:
A household account the Host provisions — the people whose food gets photographed. Signs in by username only, never sees deploy config. Includes everyone from spouse to teenager. The person is the app-owned `users` row (the aggregate root) and shares its primary key with the Identity (the Better Auth credential); `role` lives on the Identity, not on `users`. Schema role value: `member`.
_Avoid_: End user, eater, account, family member.

**Meal**:
One log entry — a single photo-capture event a Host or Member creates by tapping "Log a meal". Always one row in the `meal` table. Snacks, drinks, and multi-plate dinners are all Meals. If we ever need the eating-occasion concept (multiple photos grouped into a single sitting), that becomes a separate term ("Sitting") layered on top of Meals — not in v1.
_Avoid_: Entry, log, item, food, capture.

**Estimate**:
The AI's read of a Meal — a single structured result containing a dish name, a per-food breakdown, model-generated clarification questions, and a confidence level. A Meal has an **append-only log of Estimates** (one per attempt: create makes the first, each Refinement or retry appends another); the **current** Estimate is the latest with `status = ok`, and unqualified "the Estimate" means that one. A failed attempt is a persisted row (`status = failed`, no analysis, an error code) — the AI failing is data the Member can retry, not a discarded error (ADR 0017). Schema: the `estimates` child table, its `analysis` JSON column carrying the content (the `Analysis` schema in `models/estimate.ts`). In UI copy, prefix with "AI" when source disambiguation matters ("AI: 150 kcal"); otherwise just "Estimate" or "the estimate".
_Avoid_: AI analysis, AI snapshot, the analysis, prediction.

**Override**:
A Member's manual correction of a Meal's totals (kcal, protein, carbs, fat), set per-field on the meal record. The Override always wins over the Estimate when the resolved Total is computed: `override.field ?? sum(estimate.foods.field)`. Independent of the Estimate — does not re-run the model. Persists across Refinements (a new Estimate does not clear an Override). Reified as a singular sub-resource: `PUT /meals/:id/override` sets it, `DELETE /meals/:id/override` Resets it; model verbs `Meal.override.set` / `Meal.override.reset`.
_Avoid_: Edit, correction, adjustment, manual entry.

**Refinement**:
A Member adds free-text context ("the chicken was closer to 200g, no olive oil") and the AI re-runs against the original photo + that text. The new Estimate is **appended** to the log (the prior one is kept as history; current = latest ok — no replace-in-place). The Refinement *text* rides on that Estimate row (`estimates.refinement_text`); the Improve estimate sheet prefills the textarea from the latest attempt's text. Does not touch the Override. Costs an AI call per Refinement. Reified as a create-only sub-resource: `POST /meals/:id/estimates` with an optional `userText` (text ⇒ Refinement, none ⇒ a plain retry of a failed attempt) → `Meal.reestimate`. (Supersedes the old singular `refinement` resource — ADR 0017.)
_Avoid_: Re-analyze, edit, replace.

**Total**:
The resolved number displayed on a Meal card — kcal, protein, carbs, fat. Computed per-field as `override.field ?? sum(estimate.foods.field)`. Unqualified "Total" always refers to this resolved value. When source-disambiguation is genuinely needed in conversation, say "the Estimate's kcal" (sum of foods) or "the Override" (Member-set number). Totals are derived at read, **never stored** (ADR 0003) — computed from the **current** Estimate's per-food values, override-first. Day-level rollups in the Day view are sums of per-Meal Totals; a Meal with no successful Estimate yet contributes nothing.
_Avoid_: Resolved total, displayed total, effective total, final number.

**Clarification**:
A specific point of uncertainty the model has identified in an Estimate — e.g. "Is the chicken closer to 150g or 250g?" or "Is the sauce oil-based?". Each Clarification is one targeted question the model would answer to tighten its own estimate. The model emits a list of Clarifications per Estimate (typically 1–3, biased toward portion disambiguation). Clarifications are the **primary actionable user-facing surface** for estimation uncertainty — they are what the Member acts on, not the abstract Confidence label. Answering a Clarification (via Refinement) reduces the Estimate's uncertainty.
_Avoid_: Question, prompt, hint, suggestion.

**Confidence**:
A data attribute on the Estimate (and recursively on each Food), one of `high | medium | low`. Used internally by eval scorers and routing logic. **Not a primary user-facing concept** — the user-facing form of uncertainty is the list of Clarifications, which is specific and actionable. The label string ("HIGH"/"MEDIUM"/"LOW") is **never** rendered in the UI. The only place Confidence surfaces visually is as the **color tint** of the "Improve estimate" button beside the AI Estimate on the Meal detail view (green/amber/red); tapping the button opens the Clarifications sheet, satisfying the rule from the prior chip era — that any Confidence affordance must couple to the Clarifications surface. Unqualified "Confidence" means the Estimate's overall value; per-Food values are "the Food's Confidence."
_Avoid_: Certainty, reliability, accuracy.

**Day**:
A `[local midnight, next local midnight)` window resolved in the Member's *current* timezone. Days are entirely a client-side bucketing concept — the server stores Meal moments (UTC ISO Z `captured_at`) and exposes range queries (`GET /api/meals?from&to`); the client groups moments into Day buckets using the Member's current TZ. "Today" follows the Member: in NYC it's NYC's day, after flying to Tokyo it's Tokyo's day. Past Meals stay anchored to the moment they happened. The Day view's UI structure is invariant — the same shell renders Today, yesterday, or any past Day.
_Avoid_: 24-hour period, calendar day, server day.

**Target**:
The Member's daily kcal goal — what they should eat to achieve their lose/maintain/gain objective. The Day view surfaces it as "calories remaining" = `Target − sum(today's Meal Totals)`. kcal only; no macro Targets in v1. Derived, not stored: read from the active Profile snapshot's inputs at request time via `Target = Maintenance + direction × weekly_rate_kg × 1100`, where `direction = sign(goal_weight_kg − weight_kg)`.
_Avoid_: Goal, daily calories, calorie budget, allowance.

**Maintenance**:
The Member's daily kcal expenditure at homeostasis — the rate at which they'd eat to neither gain nor lose weight. Computed as Mifflin-St Jeor BMR × Activity Level multiplier from the current Profile snapshot's inputs, on demand. Derived, not stored. Forms the floor of the Target derivation.
_Avoid_: TDEE (close but standard TDEE adds exercise/NEAT multipliers we don't model), BMR (BMR is a component, not the whole thing).

**Activity level**:
A Member's typical movement band, picked from four options during Onboarding: `sedentary` (multiplier 1.2), `light` (1.375, exercise 1–3 days/wk), `moderate` (1.55, 3–5 days/wk), `active` (1.725, 6–7 days/wk). The multiplier is the only thing it does — gets factored into Maintenance. Editable from Profile.
_Avoid_: Activity, exercise level.

**Attachment**:
A record's media held in a named slot. One polymorphic `attachments` table backs every slot; the meal photo is the Meal's optional `photo` slot (`has_one_attached`). The slot is declared on the model; "a photo is required" is a create-time rule, not a `NOT NULL` constraint.
_Avoid_: blob, file, upload (the row).

**Goal weight**:
The Member's target body weight in kilograms, set via slider during Onboarding (defaults to their current Weight, i.e. Maintain) and editable on Profile. Combined with `weekly_rate_kg`, drives the Target's deficit/surplus direction: Goal weight below current Weight = lose, equal = maintain, above = gain. No separate `goal` enum is stored — direction is derived from `sign(goal_weight − weight)`.
_Avoid_: Goal, target weight, weight goal.

**Saved Meal**:
A Meal a Member has bookmarked for easy re-logging. **Not a separate row** — it's a marker on the existing `meal` row (`meal.saved_at` non-null ⇒ saved; see ADR 0008). Editing a Saved Meal is editing the underlying source Meal — same `/meals/:id` page, same APIs, no parallel edit surface. Re-logging a Saved Meal **clones** the source's Estimate, Override, and R2 photo into a brand-new Meal timestamped now (the e-commerce basket pattern — independent lifecycles after the clone). The new Meal does not inherit the source's `saved_at`. Bypasses AI inference entirely on re-log. Reified endpoints: toggle via `POST /meals/:id/saved` (save) / `DELETE /meals/:id/saved` (unsave); the saved list is the scope `GET /meals?saved`; re-log via `POST /meals/:id/clones`. Display name in v1 is always `aiAnalysis.dishName` — per-Saved-Meal renaming is deferred to v2. Cloned Meals are indistinguishable from freshly-photographed Meals in the UI — same universal `~` kcal prefix every MealCard already carries, no special marker, no back-link to the source.
_Avoid_: Template, favorite, quick-add, recipe, saved meal table (no such table).

**Weight**:
One logged bodyweight measurement by a Member, stored canonically in kilograms. One row in `weight_log` per Weight. Listed as "Weights" (plural) in the history view. The Member's display unit (kg or lb) is a profile setting, not part of the Weight itself. After ~4 weeks of Weights + Meal data, the trend feeds Target calibration (deferred logic; see PRD §6.7). A Member can delete a Weight from the Progress chart; deletion affects only `weight_log` and never the historical `profile_log` snapshots that may have been driven by it — past plans are sealed (ADR 0002, ADR 0007).
_Avoid_: Weigh-in, weighing, weight entry, weight log (the table, not the row).

**Progress**:
The multi-Day rollup view a Member visits to see their Weight trend over time, their daily Total intake pattern relative to Target, and their current BMI snapshot. Three cards top-to-bottom: Weight chart (raw `weight_log` points, period-filterable 1M/3M/6M/1Y, no aggregation — every weigh-in is a real data point), Calorie history (bars colored against historical per-day Target using `snapshotFor`: 🟢 ≤Target, 🟡 0–15% over, 🔴 >15% over — same thresholds as the Day view's week strip; period-aggregated 7D daily / 30D daily / 90D weekly avg / 1Y monthly avg), BMI panel (universal bands rendered against kg axis computed from the Member's current height). Distinct from the Day view, which scopes to a single Day's Meals + Target. Also the canonical surface for logging Weights and for correcting wrong dots (delete-only; see ADR 0007). Tab in the bottom nav between Today and Profile.
_Avoid_: History, Trends, Stats, Insights.

**Setup**:
The one-time, per-deploy wizard that creates the Host account. Triggered automatically when the deploy has zero Hosts; suppressed forever after. Produces the Host's Identity (`identities` row, `role = 'host'`) plus the provisioned `users` person row sharing its primary key, and initializes the `app_settings` singleton. Host-only.
_Avoid_: Install, initialization, deployment, first-run.

**Password link**:
A single-use, Host-issued URL token that lets the recipient set a password on an account. An app-domain concept (not part of the Better Auth instance, which stays delivery-free — nothing is sent; the Host hands the link over out of band). The same mechanism backs two distinct Host actions — adding a Member and resetting a Member's password — issued via the member's singular `password-link` sub-resource (`POST /admin/members/:id/password-link`; first-issue and reset are the same path) and redeemed via the public token-addressed `password-links` resource (`GET /password-links/:token`, `POST /password-links/:token/password`). The friendly `/set-password/:token` is the page; the resource is `password-links`. Possession of the token is the credential. Exactly one Password link per Member can be active at a time — generating a new one replaces the old. Deleted the moment the password is set. Also expires by TTL if unredeemed.
_Avoid_: Invite, magic link, reset link, invitation, signup token.

**Onboarding**:
The one-time, per-account flow that produces a Member's first Profile snapshot (sex, birthday, height, current weight, activity level, goal weight, weekly rate). Universal — every account goes through it once, including the Host (because Hosts eat too). Triggered when the account has no Profile snapshot ("onboarded" is derived from "has ≥1 `profile_snapshots` row," not a column; see ADR 0011). Distinct from Setup: Setup is host-creates-themselves; Onboarding is profile-creation. Onboarding's snapshot is the only Profile edit that takes effect immediately (same-day); subsequent edits apply starting next local midnight.
_Avoid_: Signup, registration, intro flow, welcome.

**Profile snapshot**:
A row in `profile_snapshots` (renamed from `profile_log`) capturing a Member's full set of inputs (sex, birthday, height, weight, activity level, goal weight, weekly rate) plus an `effective_from` local date marking when this snapshot starts applying. The Member aggregate owns the collection. An edit is an **append** of a new snapshot, never an in-place update: created on Onboarding (`effective_from = today`) and on every Profile edit (`effective_from = tomorrow`, so today's plan stays sealed). Day-summary calculations resolve a day's Target by finding the snapshot whose `effective_from` is the latest date `≤` the day in question. There is no separate "current profile" table — the latest snapshot serves as current state.
_Avoid_: Profile, profile row, user profile, current profile.

**Analysis Status**:
The **Meal** has no status column — but the **Estimate** carries `status` (`ok | failed`), and that is where the lifecycle lives (ADR 0017). Meal creation is **synchronous** (the Member waits; the client spinner is the only "loading" UX) but no longer *atomic-gated*: the `meal` row persists first, then the first Estimate appends — `ok`, or `failed` (no analysis, an error code) which the Member retries against the same stored photo. So a meal **can** exist with only a failed Estimate (the retry state); the old "a row exists ⟺ a valid Estimate" rule is superseded. There is still no async `pending` — the call is inline; a "failed" Estimate is a stored row, not a discarded request error. Distinct from `notAnalyzable`, which is a *successful* call's "this isn't food" verdict (content on the analysis), not a `failed` status (the call itself broke).
_Avoid_: meal status, pending, async; (note: `failed` is now a real Estimate status, not a forbidden term).

## Example dialogue

> **Dev:** "When a Member logs a Meal, should it show up in the Host's day view?"
> **Domain:** "No — Meals are scoped to the account that captured them. The Host sees only their own Meals in their day view. Cross-account visibility lives in the admin surface."
> **Dev:** "So `meal.user_id` is who *captured* it, not who *ate* it?"
> **Domain:** "Same person. Sufra doesn't model 'I ate this for someone else.' The Member logged in is the Member eating."
