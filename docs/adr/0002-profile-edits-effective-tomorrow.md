# Profile edits take effect starting next local midnight

Every Profile edit writes a `profile_log` row with `effective_from = tomorrow_local_date` (Member's current TZ at edit time). Today's plan is *sealed* from the moment the day begins — calorie targets, macro goals, and week-strip status colors don't shift mid-day under the Member's feet. Onboarding is the only exception: the first `profile_log` row carries `effective_from = today` because the Member is bootstrapping their first plan with nothing to seal.

## Why

The bad UX this avoids: a Member eats 1,200 kcal toward an 1,800 kcal Target by 3pm, then switches from Maintain to Lose. If the edit applied immediately, the Day Summary panel would jump from "600 remaining" to "300 remaining" with no warning — same logged meals, different reading. That contradicts honest framing (PRD §4) and the principle that the Member should know what they're aiming at all day.

The same rule extends to weight changes: a morning weigh-in doesn't shift today's Target. Stability of today is the load-bearing property.

## Considered alternatives

- **Apply immediately.** Rejected — mid-day target shift problem above.
- **Apply at the next meal log.** Rejected — couples plan changes to meal-logging behavior; surprising and inconsistent across light vs heavy logging days.
- **Let the Member choose "today" or "tomorrow" per edit.** Rejected for v1 — adds a decision the Member shouldn't have to make. Could revisit if dogfooding reveals frequent "I want this now" friction.

## Consequences

- Edit sheets surface a "Starting tomorrow: X kcal" label as the transparency affordance, parallel to the 🔑 password-link icon — small visual cue, no prose explanation needed.
- `/how-it-works` carries the rule explicitly in a "When your goals change" section.
- Past-day Day Summary panels read `profile_log` for the snapshot whose `effective_from` is the latest date ≤ that day's local date. Historical Targets are permanent.
- A Member impatient for same-day effect is told (via the label, then the explainer) to wait until tomorrow. That is the price of stability and it is explicit.
- The `UNIQUE(user_id, effective_from)` constraint cleanly handles "edited twice today" — both writes target the same tomorrow row; latter overwrites via `ON CONFLICT UPDATE`.
