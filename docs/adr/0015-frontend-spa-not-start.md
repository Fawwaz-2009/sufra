# The frontend stays a TanStack Router SPA (not Start), forward-compatible with Expo

The frontend remains a TanStack Router SPA — NOT TanStack Start / SSR — and stays a PWA (workbox, the `InstallGate`, standalone-gated). It adopts the conventions' data seam: the typed Effect `HttpApiClient` derived from `worker/contract` (`getClient` + `run`), which replaces the Hono RPC client and both raw-`fetch` escape hatches. Route-folder colocation (`-queries`/`-components`/`-search`, ADR 0006) survives. Reads stay loader `ensureQueryData` + `useSuspenseQuery`; writes stay `useMutation` + invalidate (never consume the mutation response). The auth gate is a `beforeLoad` calling `authClient.getSession()` → redirect — the skill's documented non-Start variant. Views serialize as plain JSON (`.Type === .Encoded`) so the wire is consumable by web and a future native client alike.

## Why

SSR is a web-only seam. The thing a web SPA and a future native Expo app actually share is the HTTP-only, typed-contract, plain-JSON backbone the skill's `frontend-expo.md` describes — not server-rendered HTML. Adopting TanStack Start would spend effort hardening a seam we'd route around the moment native lands, and it would fight the install/service-worker story.

The skill itself sanctions the non-Start SPA auth gate as a documented variant, so staying on the SPA is not a deviation — it's a supported path. Sufra is an installed, mobile-first PWA; SSR's payoffs (SEO, cold first-paint) are marginal for an app that lives behind an `InstallGate` on a household member's home screen, and the service worker already owns the load story (`/api/*` is NetworkOnly).

The data seam is where the re-platform reaches the frontend. The Effect `HttpApiClient` is derived from the same `worker/contract` the controllers serve, so the wire is typed end-to-end. That kills the two raw-`fetch` hatches that survived the Hono RPC era — the multipart photo upload and the override PATCH (the latter the source of the null-vs-absent bug, now dead anyway via PUT-replace, see ADR 0012). Plain-JSON views (`.Type === .Encoded`, no effectful encoding) keep the contract consumable by both a browser cookie client and a native cookie-replay client.

## Considered alternatives

- **Full TanStack Start / SSR.** Rejected — SSR is a web-only seam we'd route around when native lands; it forces PWA/workbox/`InstallGate` rework for marginal benefit on an installed app; Expo makes the HTTP-only typed-contract the shared shape, and SSR is not part of it.

## Forward-compat with Expo

The mechanism for native readiness is decoupling, not premature abstraction. `contract/`, `models/`, and `views/` stay strictly browser-safe (the boundary set that supersedes the old `isomorphic/` layout per ADR 0005, established in ADR 0009) and free of SPA-only deps, so they lift wholesale into a shared `packages/contract` when Expo lands. At that point both the web SPA and the Expo app become thin consumers of the same typed `HttpApiClient`. Auth differs only at the edge — web carries the cookie automatically; native replays the session cookie out of SecureStore — behind the same `getSession` bridge the `beforeLoad` gate already calls.

## Consequences

- The PWA shell — workbox config, `InstallGate`, standalone gating — and the ~80 components survive largely intact, reshaped only at the data seam.
- The typed `HttpApiClient` (`getClient` + `run`) replaces the Hono RPC client (`hc<AppType>`) and removes both raw-`fetch` hatches (multipart upload + override PATCH).
- The auth bootstrap moves from the `AuthProvider` `Promise.all` toward a `beforeLoad` gate calling `authClient.getSession()` → redirect.
- Reads (`ensureQueryData` + `useSuspenseQuery`) and writes (`useMutation` + invalidate) keep their existing shapes against the new client.
- **Preserves ADR 0006** — route-folder colocation (`-queries`/`-components`/`-search`) is unchanged.
- Sets up the `packages/contract` lift for Expo: keep `contract`/`models`/`views` browser-safe and SPA-decoupled so the shared client is a later extraction, not a rewrite.
