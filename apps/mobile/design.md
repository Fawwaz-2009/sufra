# Design — Sufra mobile · "Daylight"

The locked design system for `apps/mobile`. Supersedes the Warm Table pass (2026-06-11, same day —
the user redirected from "re-tint the wireframe" to "rebuild the bones"). Direction chosen by the
user from the study of ente.com, flighty.com, structured.app, element.io, signal.org:
**photo-forward light** — the Flighty/Ente school.

The thesis: **the meal photo and the Day ring are the heroes; everything else recedes.** Sufra's
food photography is its emotional payload (what family photos are to Ente). White, airy, native
system type at fearless sizes, ONE accent. The app must be photogenic enough to carry its own
marketing.

## Palette

Same hex in two places by necessity: `src/global.css` `@theme` (classes) and
`src/constants/theme.ts` `Palette` (style props: SafeAreaView, SVG, placeholders).

| Token        | Hex       | Role |
| ------------ | --------- | ---- |
| `white`      | `#FFFFFF` | Screen background. Open space IS the design. |
| `surface`    | `#F5F4F2` | Quiet panels, input fills, photo-less boxes (warm gray, not blue) |
| `track`      | `#EBE7E1` | Ring track, bar tracks, image placeholders |
| `line`       | `#ECE9E4` | Hairline borders (cards, dividers) |
| `ink`        | `#1A1816` | Primary text — near-black, warm bias |
| `ink-soft`   | `#75706A` | Secondary text, labels |
| `ink-faint`  | `#B9B3AA` | Disabled, placeholders, future days |
| `flame`      | `#E45527` | THE accent (ember): ring, primary action, selected states, links |
| `flame-deep` | `#C2431D` | Pressed flame; flame as small text on white |
| `teal`       | `#45929A` | Protein, within-target bars |
| `amber`      | `#D99A36` | Carbs, near-target |
| `red`        | `#C73A2A` | Errors, over-target, destructive |

Ring gradient (SVG only): `#E45527 → #F0883F`. Backdrop: `rgba(20, 16, 12, 0.5)`.
LEGACY ALIASES (`cream`→white, `card`/`sand`→surface, `sand-2`→track) exist only until the class
rename sweep lands; new code must use the truthful names.

## Typography — system, heavy, native

System font (SF / Roboto) ONLY. No serif in-app. `DisplayText` (`components/display-text.tsx`) is
system weight-800 with tight tracking — screen titles and hero numerals. Numerals use
`fontVariant: ['tabular-nums']` where they update in place (the ring). Scale anchors: ring number
40/heavy · screen title 28/heavy · card kcal 17/heavy · dish name 17/semibold · body 15 · labels
13 · caps-labels 11/semibold/uppercase.

## The bones (what makes it NOT a wireframe)

- **Today**: no gray containers. The ring (200pt, stroke 13, ember gradient on `track`) sits
  directly on white; the macro trio (label · value · 4pt bar) in a row beneath it; one full-width
  flame pill action + quiet text-button row; then full-width photo meal cards.
- **Meal card**: the photo IS the card — full-width, ~190pt tall, top-rounded 20; beneath it a
  white bar (hairline border, bottom-rounded 20): dish name left, `~620` kcal heavy right, macro
  line small under the name. Failed estimate = photo + amber "Tap to retry" row.
- **Meal detail**: photo big (4:3, rounded 24) at top; kcal hero row; foods as clean hairline
  rows; actions per the button rules.
- **Buttons**: primary = flame pill (h-13, white 17/semibold text); secondary = surface pill,
  ink text; tertiary = bare text button (flame-deep or ink-soft). Destructive = red TEXT, never a
  red fill.
- **Chrome**: white tab bar, ember selected; large-title headers; sheets are white with the
  system grabber feel.

## Motion stance

Platform-native only (NativeTabs, Alert, RefreshControl, sheet slides). Earned extras later: ring
sweep on first load, photo-card press scale. Nothing speculative.

## Out of scope for code (flagged, separate tasks)

- The flat logo glyph + regenerated icon/splash assets (splash stays cream until then).
- Marketing site re-derivation from this system (after the app is photogenic).

## Pipeline discipline (unchanged, load-bearing)

- Every className must be in a `global.css` `@source inline(...)` allowlist, every color in
  `@theme`; a missing class is a SILENT no-op — audit after writing.
- `className` never on SafeAreaView (style prop: `Palette.white`) nor on react-native-svg
  elements (props only).
- No `dark:`/state variants; light pinned.
