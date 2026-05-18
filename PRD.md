# Sufra — PRD (v0.1)

*A photo-first calorie tracker for the people at your table.*

---

## About the name

*Sufra (سفرة)* is the Arabic word for the dining table — but it means more than the furniture. A sufra is the spread of food laid out, the act of gathering people around it, the hospitality of feeding the people you love. In Arab and Middle Eastern cultures, the family sufra is a near-sacred space.

The name is deliberate. This app exists to help you stay *at* the sufra — to keep showing up and sharing food with the people you love, while staying aware of what you're eating. It's not here to police what's on your table. It's here to make what's on your plate legible, so the choices you make at the table are yours.

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

End users are explicitly assumed to span languages. Many will not use the app at all if it's English-only. v1 ships with English and Arabic; the architecture must support adding languages without code changes (translation files only).

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

| Project | Scope | AI photo | Multi-user | Uncertainty UX | Distribution |
|---|---|---|---|---|---|
| MyFitnessPal / Cal AI | comprehensive | yes, cost-constrained | SaaS | single number or none | native app |
| SparkyFitness | comprehensive (food + fitness + water + sleep + mood) | yes | yes | none | self-host, web |
| caloriemate | calories + protein only | yes | single user | free-text retry | self-host, web |
| OpenNutriTracker / Food You | nutrition (DB-driven) | no | single user | n/a (precise lookup) | mobile native |
| **Sufra** | calories + macros + key nutrients + weight | yes, host-paid inference | yes (host-provisioned) | structured confidence + targeted clarification | Cloudflare-deployed PWA |

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
2. **Trust.** Users believe estimates are reasonable *because* the app is honest about what it's unsure of, not despite it. A user who corrects an estimate sees the correction reflected in the next similar meal.
3. **Effortlessness.** Logging a meal — photo to confirmed entry — takes under 15 seconds in the common case. If logging takes longer than eating a snack, adherence collapses.
4. **Deployability.** A host with a Cloudflare account and an OpenRouter API key can deploy a working Sufra instance via `wrangler deploy` in under 10 minutes, with no infrastructure decisions to make.
5. **Onboardability for end users.** A non-technical end user, handed a URL and credentials by the host, can install the PWA and log their first meal in under 2 minutes with no help.

---

## 6. Core Features (v1)

### 6.1 Auth (host and end users)

Shared login form, role-based routing after authentication. Same URL for both roles; the server determines where to send each post-login.

**First deploy.** Worker comes up, D1 has zero users. First visit triggers a setup wizard: host picks a username and password, the wizard creates the host record with `role = 'host'`, sets a session cookie, redirects to admin. The wizard only ever runs when zero hosts exist.

**Provisioning end users.** From admin, host types a username and a temporary password; record is created with `role = 'user'` and `must_change_password = true`. Host hands credentials to the end user out of band (text, in person, paper). No email is ever involved.

**End user first login.** Login form → temporary password accepted → forced password-change screen → "Add to Home Screen" prompt with platform-specific instructions → onboarding flow → Day view.

**Steady-state.** httpOnly cookie carries an opaque session token, validated against D1 on every request. 90-day rolling expiry, configurable. Host can revoke any active session from admin.

**Password reset.** End user forgets password → asks host → host sets a new temporary password in admin → end user forced to change on next login. Manual, social, deliberate.

**Host forgets their password.** Broken-glass recovery: a `wrangler`-callable admin endpoint gated by a deploy-time secret. Documented in the README. Ugly but honest about what no-email means.

**Brute-force protection.** Per-username and per-IP rate limiting with progressive lockout. Cloudflare's built-in rate limiting as a second layer.

**Storage.** `users` table (id, username, password_hash via argon2id, role, must_change_password, created_at, last_login_at). `sessions` table (token, user_id, expires_at, created_at, last_used_at, user_agent). That's the entire auth schema.

### 6.2 Onboarding (end user, first launch)

Five screens, ~75 seconds for a motivated user:

- **Language.** First screen, before anything else. Picker showing each available language in its own script ("English", "العربية"). Default highlighted based on browser `Accept-Language`, but always shown — host-set defaults can be wrong for any individual user. Choice is saved to the user profile; subsequent logins skip this screen and load the user's language immediately. Switching language later is possible from settings.
- **Welcome.** "This app helps you understand what you eat. Take photos, get calorie estimates, see your trend over time."
- **About you.** Sex, age, height, current weight, activity level (sedentary / light / moderate / active — four buttons with inline definitions, not a slider).
- **Your goal.** Lose / maintain / gain weight. If lose or gain, an optional weekly rate (default 0.5 kg/week).
- **Your numbers.** Computed maintenance via Mifflin-St Jeor × activity multiplier, presented with framing: "Based on what you told us, you burn about 2,200 kcal/day. To lose 0.5 kg/week, eat about 1,700 kcal/day. We'll refine these as you log — the first estimate is a starting point." User can adjust manually; aggressive deficits get a one-line warning but aren't blocked.

After the last step the user lands in Day view, empty state, with a prominent capture button.

### 6.3 Meal capture (photo-first)

Default action on opening the app is to take a photo. Capture screen has one prominent shutter button and one secondary "pick from library" action. After capture, photo uploads to R2 via signed URL, then the Worker calls OpenRouter with the vision prompt and structured-output schema. A skeleton state shows during inference (~3-5 seconds typical). Result card displays: estimated calories, macros (protein/carbs/fat), key nutrients (fiber, sugar, sat fat, sodium — no goals attached), and a confidence chip (High / Medium / Low).

### 6.4 Structured confidence and clarification

Internally, the estimate decomposes into three components: food identification, portion size, and recipe/preparation assumptions. Each has its own model-reported confidence. The displayed value is a combined one, but tapping the confidence chip opens a clarification view listing the model's uncertainties as questions ("Is the sauce oil-based?", "Closer to 1 cup or 1.5 cups?", "Is there meat in this?"). User answers any subset; the estimate re-computes with answers as added context. Free-text additional context is available as a fallback. Clarifications are capped at 2–3 rounds per meal to bound inference cost.

### 6.5 Saved meals

Two-phase approach, both in v1:

- **Explicit match:** before capture, user can tap "Log a saved meal" and pick from a list. Bypasses inference entirely.
- **Implicit match:** during normal photo analysis, the model is given the user's saved meal names as part of the prompt. If it matches one, the UI shows "Looks like your usual oats — use saved values, or compute fresh?"

Saved meal values are always shown with a "≈" prefix — real portions vary.

### 6.6 Day view + Week strip

Day view defaults to today, swipeable to prior days. "Today" follows the user's current location — when they travel, the day boundaries shift with them. Shows:

- Calories remaining (primary number, prominently displayed)
- Macro breakdown (protein/carbs/fat visual)
- Key nutrients (small, secondary)
- List of today's meals, each tappable to refine or edit

Week strip at the top: 7 dots showing recent days. Green = within target (including under), Yellow = 0–15% over, Red = >15% over. Trajectory at a glance.

### 6.7 Weight tracking + maintenance refinement

Dedicated weight screen. User can log a weight any time; suggested cadence is weekly. Trend line in history. After ~4 weeks of weight + intake data, the app surfaces a maintenance refinement suggestion: "Based on your logging, your actual maintenance looks closer to 2,050 kcal than the 2,200 we estimated. Update?" Refinement requires user confirmation — we don't silently move the target.

### 6.8 History and trends

Past days scrollable. Weekly/monthly chart of intake vs target. Weight trend. Macro composition over time. No AI-generated commentary in v1.

### 6.9 Host admin

Separate `/admin` route accessible only to `role = 'host'`:

- OpenRouter API key configuration
- Vision model selection (with sensible defaults)
- Default language for newly created accounts
- User CRUD (create, reset password, deactivate)
- Active session view + revoke
- Optional deficit safety bounds toggle
- Inference cost view (if OpenRouter exposes it)

End users have no path to this surface.

### 6.10 Localization

Multi-language is a property of the whole app, not a feature.

**Languages at launch.** English and Arabic. Adding a third language is a translation contribution — drop a JSON file into `src/locales/`, no code changes.

**Selection.** Step 0 of onboarding (see 6.2). Choice persists on the user profile. Settings screen has a language picker so users can switch later. Host can pre-set a default language for new accounts.

**RTL.** Arabic flips the layout. Layout is built from day one with logical CSS properties (`ms-*` / `me-*` over `ml-*` / `mr-*`, `text-start` over `text-left`); `dir="rtl"` on `<html>` handles the rest automatically. Directional icons (back arrows, etc.) get mirrored.

**Numbers and dates.** Western Arabic numerals (0123456789) by default in both languages. Dates formatted via `Intl.DateTimeFormat` with the user's locale. Eastern Arabic numerals (٠١٢٣٤٥٦٧٨٩) are a per-user toggle for Arabic users who prefer them.

**LLM output language.** The vision model is prompted in the user's language and instructed to return food names, recipe assumptions, and clarification questions in that language. Modern vision models handle Arabic output well. Saved meals are stored in the language they were created in — there's no cross-language meal sharing in v1.

**What's translated.** All UI strings, error messages, onboarding copy, and the LLM system prompt. Documentation (README) ships in English only; community translations welcome.

---

## 7. User Stories

**Host stories**

- *As the host, I can deploy Sufra with `wrangler deploy` and an OpenRouter key, and have a working instance behind my own URL within 10 minutes.*
- *I can create an account for my partner, hand them a URL and login, and they can use Sufra without me explaining anything.*
- *When my mother forgets her password, I can reset it from the admin panel in two clicks — no email round-trip.*
- *I can see roughly how much inference cost my instance has incurred this month, so I can decide if I need to change models.*

**End user stories**

- *I open the app, photograph my lunch, see "~580 kcal, medium confidence," and either accept it or tap the confidence chip to answer two questions that tighten the number — all within 20 seconds.*
- *When I eat my usual oats, I can tap a saved meal instead of taking a photo, and I still see that the estimate is approximate.*
- *I can log my weight on Sunday morning and see whether my actual progress matches what the app projected.*
- *After a month of logging, the app tells me my real maintenance seems different from the original estimate and asks if I want to adjust my target. I say yes (or no) and continue.*
- *I can swipe back to yesterday to remember what I ate, and see at a glance whether last week trended green or red.*

---

## 8. Architecture & Tech Decisions

### 8.1 Stack

- **Frontend:** Vite + React + TanStack Router + TanStack Query + vite-plugin-pwa + Tailwind
- **i18n:** react-i18next with lazy-loaded JSON locale files; logical CSS properties throughout for RTL
- **Backend:** Hono on Cloudflare Workers, with Hono RPC for end-to-end type safety
- **Single Worker** serving both static assets (the built React bundle) and `/api/*` routes
- **Database:** Cloudflare D1 (SQLite-compatible); schema versioned and migrated via Wrangler
- **Storage:** Cloudflare R2 for meal photos, accessed via signed URLs only
- **Inference:** OpenRouter (host's key, configured at deploy); Gemini 2.5 Flash as default vision model
- **Auth:** rolled, username/password, sessions in D1, argon2id for hashing (WASM in Workers)
- **Deploy:** `wrangler deploy` from the repo

### 8.2 Why this shape

TanStack Start (the SSR meta-framework) was considered and rejected. Its build pipeline currently doesn't play cleanly with vite-plugin-pwa — workarounds exist but are brittle, and SSR's value is minimal for an authenticated PWA opened from a home-screen icon. TanStack Router gives us file-based, type-safe routing without the build friction. Server context (secrets, D1, OpenRouter calls) lives in Hono routes under `/api/*` on the same Worker. Hono RPC bridges the seam with full type inference; client code does `client.api.meals.analyze.$post(...)` with autocomplete and return types.

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

Model returns JSON (simplified):

```ts
{
  foods: [{ name, portion_estimate, portion_unit, confidence }],
  recipe_assumptions: [{ assumption, confidence }],
  macros: { kcal, protein_g, carbs_g, fat_g },
  key_nutrients: { fiber_g, sugar_g, sat_fat_g, sodium_mg },
  matched_saved_meal: string | null,
  clarifications: [
    { id, question, type: "binary" | "choice" | "scale", options?: [] }
  ],
  overall_confidence: "high" | "medium" | "low"
}
```

Clarification questions are generated by the model from its own uncertainties. The user answers any subset; answers are appended to the next inference call as additional context. We don't try to mathematically update components — we just re-ask the model with more information.

### 8.5 Time and day boundaries

Meals are stored with full ISO timestamps including offset (e.g., `2026-05-18T20:00:00-05:00`). The moment and the timezone it was recorded in are both preserved.

Day-segmentation is a client-side concern. The server exposes range-based queries (give me meals between two UTC moments); the client decides what range corresponds to "today" or "this week" based on the user's current timezone. When the user travels, "today" follows them — Bali days when in Bali, New York days when in New York. Past meals stay anchored to the moments they happened.

This means we don't try to be authoritative about what day a meal "belongs to" in some absolute sense. We present a consistent view based on where the user is now. A traveler with a 30-hour day from crossing timezones just sees more meals in that day's record — a faithful representation rather than a forced bucketing.

### 8.6 What we're NOT building in v1

- No CLIP / embedding-based meal matching (LLM-naming is enough)
- No background jobs or queues (everything request-response)
- No analytics or telemetry
- No custom CDN config (Cloudflare defaults)
- No custom domain automation (host points their own or uses workers.dev)

---

## 9. Milestones

Scoped for ~1 week of focused work. Each milestone is end-to-end testable.

**M1 — Skeleton & deploy path (Day 1)**
Repo with Vite + Hono single-Worker scaffolding. `wrangler deploy` produces a working hello-world. D1 provisioned with migration runner. R2 bucket provisioned. Login screen, session handling, setup wizard creates first host.
*Exit:* host can clone repo, deploy, create admin account, log in.

**M2 — Onboarding & Day view shell (Day 2)**
Admin can create end-user accounts. End user can log in, complete onboarding, see Day view with target and empty meal list. Week strip renders gray.
*Exit:* end user can be provisioned and reach empty Day view with target visible.

**M3 — Meal capture & analysis (Days 3–4)**
Camera capture (or library fallback). Photo upload to R2 via signed URL. OpenRouter call with vision prompt and structured output. Meal saved to D1. Meal card in Day view with confidence chip. Totals update; week dot updates.
*Exit:* end user can photograph a meal and see it logged.

**M4 — Clarification flow (Day 5)**
Tap confidence chip → clarification view → model-generated questions → user answers → re-inference → updated estimate. Original photo and clarification history retained on meal detail.
*Exit:* end user can refine an inaccurate estimate by answering 1–3 questions.

**M5 — Saved meals & weight tracking (Day 6)**
Save logged meal as named template. Log-from-saved flow (skips inference). Prompt includes saved meal names for implicit matching. Weight log + trend chart. Maintenance refinement logic (≥4 weeks data) surfaces suggestion.
*Exit:* end user can save/re-log a usual meal and log weight to see trend.

**M6 — History, polish, deploy docs (Day 7)**
History view (past days, week/month chart). Admin polish (API key rotation, model selection, cost view, user CRUD complete). Arabic translation pass — every UI string translated, RTL layout verified on real device, LLM prompt tested for Arabic output quality and Middle Eastern dish recognition. README with deploy guide and "About the name" section. Add-to-Home-Screen prompt and instructions. Error states, skeletons, basic offline handling.
*Exit:* shippable. Another host could deploy a fresh Sufra instance from the README alone.

---

## 10. Open Questions & Risks

### Open questions

1. **OpenRouter zero-log claim — verified scope?** Marketing says zero log; does this apply uniformly across upstream providers OpenRouter routes to? Affects the privacy claim in README.
2. **R2 photo lifecycle.** Keep forever (default), or auto-delete after N days with host toggle? Free tier is generous but not infinite.
3. **Photo preprocessing.** Client-side resize to max 1024px long edge, JPEG q85 before upload — confirm?
4. **Vision model default.** Gemini 2.5 Flash recommended, with Claude Haiku 4.5 and GPT-4.1-mini as documented alternatives. Confirm default? Verify Arabic output quality AND Middle Eastern dish recognition during the Day 1 inference prototype.
5. **Maintenance refinement window.** Default 4 weeks of logging data before surfacing suggestion. Host-configurable, or fixed? Right window length?
6. **Safety floor on deficits.** Soft warning above 25% deficit, no hard block. Confirm or push back?
7. **Eastern Arabic numerals as default for Arabic?** Currently planning Western (0-9) as default with Eastern as toggle. Worth checking with a few family members which feels more natural.
8. **Domain.** `sufra.app` availability check needed. If taken, fallbacks: `sufra.dev`, `sufra.food`, `getsufra.com`.
9. **Day cutoff setting.** Default day boundary is local midnight. Some users (late-night eaters) want a configurable cutoff (e.g., 4am). Deferred to post-v1 unless real users ask; flag it here so we don't forget.

### Risks

1. **The structured confidence flow doesn't pan out.** Load-bearing claim of the whole project. *Mitigation:* prototype the inference call in isolation on Day 1, before committing to UI work. If clarification questions are bad, positioning needs rethinking before we build the rest.
2. **OpenRouter cost is higher than expected.** Clarifications multiply inference calls. *Mitigation:* measure during dogfooding, cap clarifications at 2–3 rounds per meal, document cost per logged meal upfront.
3. **PWA limitations on iOS.** Camera access, push notifications, storage eviction. *Mitigation:* test on real iOS hardware early in M3. Document the Add-to-Home-Screen gesture clearly. Expo wrapper as v2 escape hatch.
4. **D1 is still relatively young.** *Mitigation:* keep schema simple, hide it behind a data-access layer, swap to Turso or Neon if needed.
5. **Build it for the family, they don't use it.** The unglamorous risk. *Mitigation:* be your own first user. Don't expand scope until two weeks of consistent personal use proves the core value.
6. **The "open source" promise creates maintenance burden.** *Mitigation:* upfront in README that this is a personal project shared publicly, not a community-maintained one. Set expectations.
7. **Arabic LLM output quality is uneven across models.** Vision models vary in how well they handle Arabic food names, regional dish identification (Middle Eastern cuisine specifically), and clarification phrasing. *Mitigation:* Day 1 prototype tests both English and Arabic prompts against the default model, with a specific test set of Middle Eastern dishes (kabsa, mansaf, fattoush, koshari, etc.). If Arabic output is poor on the default, document an Arabic-preferred alternative in admin model selection.
8. **Tonal drift — the name pulls warmer than the function.** Sufra is celebratory and abundant; calorie tracking is, at some level, the opposite. *Mitigation:* hold the framing as "Sufra helps you stay at the sufra," not "Sufra helps you avoid the sufra." Any feature that sounds restrictive or shame-coded gets the name pulled out of its description as a sanity check — if it reads wrong with "Sufra" in the sentence, it's probably wrong regardless.