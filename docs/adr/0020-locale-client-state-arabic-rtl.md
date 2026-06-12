# Locale is client state; Arabic + RTL conventions

Add Arabic as Sufra's second language. **v1 scope: the mobile app's UI + the AI's Estimate output.**
The web SPA, the Setup/password-link browser flows, and the marketing site stay English (the web
client's retire-vs-freeze question is parked and does not block this). The **Locale is client state**
(CONTEXT "Locale"), in the ADR 0018 pattern: device-language default (`expo-localization`), an
explicit Language setting in Profile, persisted on the device, never stored by the server.

## The wire

`locale?: string` is added to the two Estimate-creating payloads — `POST /meals` and
`POST /meals/:id/estimates` — and nowhere else: the server needs the Locale only at the moment it
talks to the model. The value is **allowlisted server-side** against `LOCALE_NAMES` and falls back to
English for anything unrecognized (this also closes the old `?? locale` raw interpolation of a
client-supplied string into the system prompt). It is **not persisted** on the `estimates` row —
every Estimate-creating request carries the client's *current* Locale, so retries and Refinements
answer in the language the Member is asking in now.

- Additive per ADR 0018: old backends decode payloads with Effect Schema's default
  `onExcessProperty: "ignore"` (verified against the installed v4), so a new client against an old
  self-hosted backend degrades silently to English output — no 400, no capability probe.
- A strict `Schema.Literals(["en","ar"])` was rejected: a future client's third locale would 400
  against this backend; the allowlist makes a new language a server-side entry, not a wire break.

## Mixed-language history: history is history

Estimates created in one language display as created after a Locale switch — the language is part of
the append-only record (ADR 0017), like the `refinement_text` the attempt was asked with. **No bulk
re-translation, no re-estimation on switch.** The existing Improve door already converts any single
Meal on demand (a Refinement re-runs with the current Locale and becomes current). The case is rare
in practice — the device-language default means most Members are in their language from Meal one —
so it gets no dedicated UI.

## Strings: Lingui

UI strings use **Lingui** (macros in source, `extract`/`compile` catalogs) rather than the
house-style typed-dictionary module. Recorded honestly: the measured inventory (~200 strings, **zero
plural-bearing copy** today) and the "no framework where a module suffices" lean both pointed at the
dictionary; Lingui was chosen as a product-owner call on DX — English-readable source with no key
bikeshedding, ICU MessageFormat headroom for Arabic's six plural categories the moment count-based
copy appears, `.po` as the standard translator format. The known costs, accepted: `lingui extract`
/ `compile` enters the dev loop (agents touching copy must re-run it), and an untranslated string
fails silently at runtime instead of at `tsc` — mitigated by putting `lingui compile --strict`
(fails on incomplete catalogs) into the verify loop. First implementation step is still the interop
spike (Babel macro through the Metro + NativeWind-preview chain, dev AND prod `expo export`) before
mass-converting strings.

Server-minted strings (typed-error `message`s, rendered verbatim per the house style) are localized
**on the client**: a `_tag` → localized-copy map (the `estimateErrorMessage` precedent), falling back
to the server's English `message` for unknown tags. No Accept-Language, no server catalogs — correct
against old backends and consistent with the server never knowing the Locale.

## RTL conventions

- **Switching language restarts the app.** `I18nManager.forceRTL` only applies at launch, so the
  Language setting commits the stored Locale + direction flags and immediately reloads via
  `expo-updates` `reloadAsync` (riding the same prebuild `expo-localization` already requires;
  dev fallback `DevSettings.reload`). One clean transition — never Arabic text in an LTR shell.
- **The Progress charts stay LTR** under RTL — time axes and the BMI scale keep left→right inside
  the plot (the Apple Health / Google Fit convention; numerals are LTR runs anyway). Titles,
  legends, filters, and all surrounding layout flip with the UI. Decided here so it never drifts.
- Layout direction rides RN logical properties — NativeWind v5's `ms-*`/`me-*`/`ps-*`/`pe-*`/
  `start-*`/`end-*` compile to I18nManager-aware style keys (spiked 2026-06-12, works); hardcoded
  `left`/`right` and directional icons get audited per screen. `text-start`/`text-end` are silently
  dropped by `react-native-css` — rely on RN `textAlign: "auto"` or `I18nManager.isRTL`.

## Typography & digits

**No custom Arabic font.** The app deliberately loads no fonts (Daylight: native-heavy, system
face); iOS renders Arabic in the system face natively. The one adjustment: `DisplayText` drops its
tight tracking (`letterSpacing: -0.4` → 0) under Arabic — negative tracking breaks connected-script
joins. **Digits are Western Arabic numerals (0-9) in every Locale** — the rule the vision prompt
already sets, mirrored in UI formatting via the `ar-u-nu-latn` locale tag; all date/number
formatting passes the chosen Locale explicitly (never `undefined`) so formatting can't desync from
the UI language.
