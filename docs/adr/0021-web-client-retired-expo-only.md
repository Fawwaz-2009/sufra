# The web client retires: Expo is the only client, the Worker serves the API

The TanStack Router SPA was Sufra's first client; the Expo app (frontend-expo.md, ADR 0018) reached
full feature parity and became the household's actual daily surface. Maintaining two frontends bought
nothing — every feature paid twice (ADR 0019's web catch-up debt was the proof) and nobody used the
web one. **The web SPA is retired**: frozen immediately (no new features, the parity invariant is
dissolved, ADR 0019's pending web catch-up is cancelled rather than completed), then stripped from the
Worker once the two flows that genuinely needed a browser go native. The Worker becomes
**API-plus-two-pages**: `/api/*`, a minimal static set-password fallback, and the `.well-known`
Universal-Links route. The marketing site (separate deployment) is untouched.

## Why

- **No web users.** The Host confirmed it outright during TestFlight rollout (2026-06-12): the family
  is on iPhones; the deployed SPA serves nobody. Dogfooding had already moved entirely to the app.
- **Only two flows ever needed a browser**, and both are onboarding seams, not features (PRD §10
  #19/#20): Setup (first-Host creation, a once-per-deployment ritual) and Password-link redemption
  (the one URL a Member touches before having the app). Both go native — the in-app Setup wizard
  (Connect's `needsSetup` now pushes it) and the in-app set-password screen reached by deep link.
  ADR 0018's "Setup stays a web ritual" consequence is overturned by this ADR.
- **Nothing else holds the SPA down.** Verified before deciding: every other web route has mobile
  parity; the test suite is 100% worker-side (zero frontend tests to orphan); the browser-safe
  `worker/{contract,models,views}` seam — the mobile app's only dependency on `apps/web` — never
  cared whether the SPA existed.
- **Two frontends is a standing tax.** Every UI decision (ADR 0019's three doors, ADR 0020's
  deliberate web-stays-English carve-out) spent words on web-vs-mobile divergence. One client ends
  that category of decision.

## What replaces the browser-only flows

- **Setup** — native wizard (`screens/setup/`), same two steps as the web wizard, against the
  existing public `POST /api/setup`; auto-signs the new Host in. Already landed with this ADR.
- **Password link** — the shared URL keeps its shape (`https://<origin>/set-password/<token>`), but
  becomes a Universal Link: installed app → in-app set-password screen (token + origin from the URL,
  Connect auto-filled); no app → a **minimal static HTML page** served directly by the Worker (not an
  SPA route) that sets the password and points at the App Store. The token's only power stays "set a
  password once" (ADR 0016) — the deep link moves where that happens, never auto-logs-in.

## Consequences

- `apps/web` keeps `src/worker/` + `src/server.ts` + tests; `src/routes/`, `src/components/`,
  `src/client/`, the PWA plumbing (manifest, service worker, InstallGate) and the Vite SPA build are
  deleted. The `ASSETS` binding shrinks to the static fallback page(s) or goes entirely; `/` redirects
  to the marketing site.
- **The Universal-Links asymmetry is accepted** (noted in PRD §10 #19): the store app's
  associated-domains entitlement names the developer's own domain at build time. Self-hosted
  backends (ADR 0018) get the web fallback page instead of the app-open — graceful, not broken. The
  Worker serves `apple-app-site-association` so any future re-build can add domains.
- The frontend tsconfig scope, `routeTree.gen.ts`, and the two-scope typecheck collapse to one
  worker scope (plus the mobile app's own).
- Positioning docs (PRD "PWA only", CLAUDE.md's parity lines, ADR 0015's SPA defense) become
  historical; ADR 0015's *server-side* choices (one Worker, no SSR) survive unchanged.
- The paid flip's paywall copy (out-of-repo plan) loses its "the web PWA stays free forever" line —
  the self-hosting story ("your data lives on your own server") carries that weight instead.
