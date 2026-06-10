# The native client is backend-agnostic: the server origin is user state

Sufra is self-hosted (host-deployed, host-paid inference). The PWA inherits that for free — the same
Worker serves the client and the API, so client and contract ship in lockstep and the origin is simply
"where you are." The store-distributed native app breaks both assumptions: Apple/Google serve the
client, and there is no single backend it belongs to. **v1 ships the native app free, bring-your-own
backend**: the server origin is **user state** — entered on first run, validated by probe, stored in
SecureStore next to the session — not a build-time constant. A hosted version, if demand ever justifies
one, is a *default value* on the connect screen, not a rearchitecture.

## Why

- **The architecture already promised this.** The native client touches only HTTP + the typed contract
  + plain-JSON views (ADR 0009/0015; frontend-expo.md). Nothing in the app knows which Worker it talks
  to. Making the origin runtime state is the last step, not a new seam.
- **The repo already trusts the app.** The `sufra://` scheme ships in `trustedOrigins` inside the
  Better Auth instance, so **every** self-hosted instance accepts the store app's cookie-replay sign-in
  with zero per-instance setup. The decision was effectively half-made.
- **The gate model extends, not changes.** frontend-expo.md replicates auth tiers as nested
  `Stack.Protected` guards. Connect is one more tier *below* login: no server URL → connect screen; no
  session → sign-in; no snapshot → onboarding.
- **The probe is free.** The public setup-status endpoint is unauthenticated, so it doubles as "is this
  actually a Sufra server?" and reports setup state in one call. If it answers `needsSetup`, the app
  says "finish setup at `<url>` first" — Setup stays a Host's one-time **web** ritual; the phone app is
  for Members.

## The drift problem — policy, not machinery

One Worker gave the PWA perfect client/contract lockstep per deploy. A store app version-drifts against
every self-hosted backend independently. The remedy is a **policy, not negotiation machinery**: wire
changes stay **additive** (new optional fields, new endpoints; never repurpose or remove). The day a
breaking change is genuinely unavoidable, the setup-status probe is where a version field goes and the
connect screen is where "your server is too old" renders. Until then, nothing is built — no version
endpoint, no capability negotiation, no min-version table.

## Mechanics

- `EXPO_PUBLIC_API_URL` demotes from sole source to **dev prefill** on the connect screen.
- The connect screen normalizes (force `https`, strip trailing slash) and probes before accepting.
- `authClient` (module-scope, static `baseURL` today) becomes a lazy/memoized factory keyed by the
  stored origin; `getClient()` already builds per call and just reads the same source.
- Password links remain web URLs on the instance (`https://<host>/set-password/<token>`) — provisioning
  is a web flow (ADR 0016); the native app starts at sign-in.

## Considered alternatives

- **Keep the origin a build-time constant; self-hosters build their own binary.** Rejected — kills the
  free-store-app distribution, demands an Expo toolchain from every Host, and forks the binary per
  instance.
- **Build version negotiation now.** Rejected — machinery for a second version that doesn't exist
  (extract-from-duplication applies to protocols too). The additive-wire policy + the probe leave a
  clean place to add it when a breaking change actually looms.
- **Launch only with a hosted backend.** Rejected — inverts the product (self-hosted, host-paid is the
  point; PRD positioning). Hosted is a later default, not the premise.
- **Native Setup flow for a fresh server.** Rejected — Setup is the Host's one-time bootstrap ceremony,
  already built on web; the app links out instead.

## Consequences

- New first-run tier: `screens/connect/` + a `client/server.ts` (`getServerUrl`/`setServerUrl`,
  SecureStore-backed); the root gate in `app/_layout.tsx` grows the connect guard above sign-in.
- App review needs a reachable demo instance: keep one up during review windows, put its URL +
  credentials in the review notes (routine for self-hosted clients — Home Assistant, Nextcloud).
- Contract discipline tightens: every wire change to `worker/{contract,models,views}` is additive until
  this ADR is superseded.
- A future hosted version = a default origin on the connect screen ("Sufra Cloud" vs "self-hosted").
