# Sufra

Sufra is a photo-first calorie tracker that one technically-capable Host deploys to their own Cloudflare account and shares with the household Members eating at their table. It exists to make calorie awareness legible to non-technical Members without per-user SaaS economics constraining estimation accuracy.

## Language

**Host**:
The technically-capable person who deploys a Sufra instance to their own Cloudflare account, configures it, and provisions accounts for the household. Holds the OpenRouter key, sees the admin surface, eats too. Schema role: `host`. There is exactly one Host per instance.
_Avoid_: Admin, owner, operator.

**Member**:
A household account the Host provisions — the people whose food gets photographed. Signs in by username only, never sees deploy config. Includes everyone from spouse to teenager. Schema role: `member`.
_Avoid_: End user, eater, account, family member.

**Meal**:
One log entry — a single photo-capture event a Host or Member creates by tapping "Log a meal". Always one row in the `meal` table. Snacks, drinks, and multi-plate dinners are all Meals. If we ever need the eating-occasion concept (multiple photos grouped into a single sitting), that becomes a separate term ("Sitting") layered on top of Meals — not in v1.
_Avoid_: Entry, log, item, food, capture.

**Estimate**:
The AI's output for a Meal — a single structured result containing a dish name, a per-food breakdown, model-generated clarification questions, and a confidence level. Always exactly one Estimate per Meal at any time; Refinement replaces it in place. Schema field: `meal.ai_analysis` (the verb-flavored field name is fine in the DB layer; the canonical domain noun is Estimate). In UI copy, prefix with "AI" when source disambiguation matters ("AI: 150 kcal"); otherwise just "Estimate" or "the estimate".
_Avoid_: AI analysis, AI snapshot, the analysis, prediction.

**Override**:
A Member's manual correction of a Meal's totals (kcal, protein, carbs, fat), set per-field on the meal record. The Override always wins over the Estimate when the resolved Total is computed: `override.field ?? sum(estimate.foods.field)`. Independent of the Estimate — does not re-run the model. Persists across Refinements (a new Estimate does not clear an Override). Cleared by Reset.
_Avoid_: Edit, correction, adjustment, manual entry.

**Refinement**:
A Member adds free-text context ("the chicken was closer to 200g, no olive oil") and the AI re-runs against the original photo + that text. The new Estimate **replaces** the prior one — no history kept. Does not touch the Override. Costs an AI call per Refinement.
_Avoid_: Re-analyze, re-estimate, clarification, edit.

**Total**:
The resolved number displayed on a Meal card — kcal, protein, carbs, fat. Computed per-field as `override.field ?? sum(estimate.foods.field)`. Unqualified "Total" always refers to this resolved value. When source-disambiguation is genuinely needed in conversation, say "the Estimate's kcal" (sum of foods) or "the Override" (Member-set number). Schema denormalizes the kcal Total as `meal.kcal_total`. Day-level rollups in the Day view are sums of per-Meal Totals.
_Avoid_: Resolved total, displayed total, effective total, final number.

**Clarification**:
A specific point of uncertainty the model has identified in an Estimate — e.g. "Is the chicken closer to 150g or 250g?" or "Is the sauce oil-based?". Each Clarification is one targeted question the model would answer to tighten its own estimate. The model emits a list of Clarifications per Estimate (typically 1–3, biased toward portion disambiguation). Clarifications are the **primary actionable user-facing surface** for estimation uncertainty — they are what the Member acts on, not the abstract Confidence label. Answering a Clarification (via Refinement) reduces the Estimate's uncertainty.
_Avoid_: Question, prompt, hint, suggestion.

**Confidence**:
A data attribute on the Estimate (and recursively on each Food), one of `high | medium | low`. Used internally by eval scorers and routing logic. **Not a primary user-facing concept** — the user-facing form of uncertainty is the list of Clarifications, which is specific and actionable. Where Confidence does appear in UI (today: a chip on the Meal card), it must couple to the Clarifications surface; a Confidence label without exposing the underlying Clarifications has been deemed broken (see PRD §10 #11). Unqualified "Confidence" means the Estimate's overall value; per-Food values are "the Food's Confidence."
_Avoid_: Certainty, reliability, accuracy.

**Day**:
A `[local midnight, next local midnight)` window resolved in the Member's *current* timezone. Days are entirely a client-side bucketing concept — the server stores Meal moments (UTC ISO Z `captured_at`) and exposes range queries (`GET /api/meals?from&to`); the client groups moments into Day buckets using the Member's current TZ. "Today" follows the Member: in NYC it's NYC's day, after flying to Tokyo it's Tokyo's day. Past Meals stay anchored to the moment they happened. The Day view's UI structure is invariant — the same shell renders Today, yesterday, or any past Day.
_Avoid_: 24-hour period, calendar day, server day.

**Target**:
The Member's daily kcal goal — what they should eat to achieve their lose/maintain/gain objective. The Day view surfaces it as "calories remaining" = `Target − sum(today's Meal Totals)`. kcal only; no macro Targets in v1.
_Avoid_: Goal, daily calories, calorie budget, allowance.

**Saved Meal**:
A Member-saved template derived from a previously-logged Meal. Lives in its own list, separate from the Meal log. Re-logging a Saved Meal creates a brand-new Meal (the Saved Meal itself is unchanged), copying the original Estimate + any Override forward, timestamped now — bypasses AI inference entirely. Name defaults to the original Estimate's dish name and is editable by the Member. Values are displayed with a "≈" prefix because real portions vary across re-logs.
_Avoid_: Template, favorite, quick-add, recipe.

**Weight**:
One logged bodyweight measurement by a Member, stored canonically in kilograms. One row in `weight_log` per Weight. Listed as "Weights" (plural) in the history view. The Member's display unit (kg or lb) is a profile setting, not part of the Weight itself. After ~4 weeks of Weights + Meal data, the trend feeds Target calibration (deferred logic; see PRD §6.7).
_Avoid_: Weigh-in, weighing, weight entry, weight log (the table, not the row).

**Setup**:
The one-time, per-deploy wizard that creates the Host account. Triggered automatically when the deploy has zero Hosts; suppressed forever after. Produces the `user` row with `role = 'host'` and initializes the `app_settings` singleton. Host-only.
_Avoid_: Install, initialization, deployment, first-run.

**Password link**:
A single-use, Host-issued URL token that lets the recipient set a password on a `user` account. The same mechanism backs two distinct Host actions — adding a Member (whose `user` row has no `account` yet) and resetting a Member's password (whose `account` row gets overwritten). The Host hands the link to the recipient out of band; possession of the token is the credential. Exactly one Password link per Member can be active at a time — generating a new one replaces the old. Deleted the moment the password is set. Also expires by TTL if unredeemed.
_Avoid_: Invite, magic link, reset link, invitation, signup token.

**Onboarding**:
The one-time, per-account flow that produces a Member's profile (sex, age, height, current weight, activity level, goal) and computes their initial Target. Universal — every account goes through it once, including the Host (because Hosts eat too). Triggered when the account has no `user_profile` row. Distinct from Setup: Setup is host-creates-themselves; Onboarding is profile-creation.
_Avoid_: Signup, registration, intro flow, welcome.

**Analysis Status**:
A Meal's AI-lifecycle state: `pending` (capture happened, AI background call hasn't completed), `analyzed` (AI returned a valid Estimate, fully usable), or `failed` (AI call errored). One-way: `pending → analyzed | failed`. Refinement does NOT cycle a Meal back to `pending` — it's synchronous, replacing the Estimate in place while the Meal stays `analyzed`. No retry path out of `failed` in v1 (see PRD §10 #12).
_Avoid_: Status, state, meal status, lifecycle.

## Example dialogue

> **Dev:** "When a Member logs a Meal, should it show up in the Host's day view?"
> **Domain:** "No — Meals are scoped to the account that captured them. The Host sees only their own Meals in their day view. Cross-account visibility lives in the admin surface."
> **Dev:** "So `meal.user_id` is who *captured* it, not who *ate* it?"
> **Domain:** "Same person. Sufra doesn't model 'I ate this for someone else.' The Member logged in is the Member eating."
