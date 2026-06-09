# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

# Sufra mobile — the second client of the same Worker

This is the Expo/React Native client for Sufra. It is a SECOND consumer of the one Cloudflare Worker
that backs the web SPA — same backend, same Better Auth, HTTP-only. Convention: read
`~/.claude/skills/fawwaz-coding-style/references/frontend-expo.md` (+ `auth.md`) IN FULL before
touching auth or the transport. UI is `@expo/ui` **universal** components (`import … from '@expo/ui'`):
native SwiftUI/Compose under the hood, so they sit inside a `<Host>` and lay out with `Column`/`Row`,
not RN flexbox; text fields are `useNativeState` observables (read `.value`), styling splits into
`style` (box: `UniversalStyle`) and `textStyle` (font).

## Auth (slice 1 — sign-in + gate)

- **Cookie-replay session, NOT bearer.** `@better-auth/expo`'s `expoClient` captures Set-Cookie into
  SecureStore and replays it; the Worker's `auth.api.getSession` bridge is unchanged. `cookieCache` OFF,
  no bearer plugin. Client: `src/client/auth-client.ts` (`expoClient` + `usernameClient`, scheme `sufra`).
- **Gate:** `src/app/_layout.tsx` is a `Stack.Protected` driven by `authClient.useSession()` — the
  authed shell is the `(app)/` group, else `sign-in`. Client-side UX only; the Worker is the real gate.
- **No Better Auth authorization on the client** — no `adminClient`/`ac`/roles. Sufra's authz is
  domain-side 404 scoping (ADR 0013); `role` is read as a plain session field when M4/M5 needs it.
- **Server counterpart (apps/web):** the `expo()` plugin + `"sufra://"` in `trustedOrigins` are required
  for device sign-in (no schema change → no migration). Sign-in 403s without them.

## Dev loop (cloudflared tunnel)

1. `cd apps/web && pnpm dev` (Vite + workerd on :5173).
2. `cloudflared tunnel --url http://localhost:5173` → an `https://<name>.trycloudflare.com` origin.
3. Set that origin in BOTH `apps/web/.dev.vars` (`BETTER_AUTH_URL=…`) and `apps/mobile/.env`
   (`EXPO_PUBLIC_API_URL=…`), then restart the web dev server.
4. `cd apps/mobile && pnpm ios` (a dev build — `@expo/ui` has native code, so NOT Expo Go). A physical
   iOS device needs the `ios.infoPlist` local-network keys (already in `app.json`); re-`prebuild` after
   `app.json` native changes — never hand-edit `ios/`.
