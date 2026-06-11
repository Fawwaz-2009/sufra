# Design — Sufra mobile · "Warm Table"

The locked design system for `apps/mobile`. Every screen reads this file before changing visual
code. Extend or amend this file when the system needs to grow — never improvise a color or class
per screen.

The concept: **sufra (سفرة) is the cloth a family spreads food on.** The app background IS the
cloth — the brand cream — and every card sits on it like a plate. The flame from the mark is the
single action color. Light mode is pinned (the brand is daylight-warm; the NativeWind preview
pipeline forbids `dark:` variants — decided, not deferred).

## Palette

Single source of truth. The SAME hex values live in two places by necessity (CSS classes can't
reach style props): `src/global.css` `@theme` (for `className`) and `src/constants/theme.ts`
`Palette` (for style props: SafeAreaView, SVG, placeholderTextColor, ActivityIndicator).

| Token        | Hex       | Role |
| ------------ | --------- | ---- |
| `cream`      | `#F6E8D5` | App/screen background (matches splash + adaptive icon — seamless launch) |
| `card`       | `#FFFBF2` | Cards, sheets, input fills — the "plate" surface |
| `sand`       | `#F0E2C9` | Nested boxes ON a card/sheet (PreviewBox, notes) |
| `sand-2`     | `#E6D3B3` | Progress-bar tracks, image placeholders, ring track |
| `line`       | `#E3D2B6` | Hairline borders everywhere (one border color) |
| `ink`        | `#3A2A1B` | Primary text (warm espresso — never pure black) |
| `ink-soft`   | `#8A7560` | Secondary text, labels, icons |
| `ink-faint`  | `#C2B197` | Disabled/future/placeholder text |
| `flame`      | `#C75320` | THE action color: primary buttons, selected day, active chips, links |
| `flame-deep` | `#9E3F16` | Pressed/emphasis flame |
| `amber`      | `#EC8F3A` | Gradient end, near-target warnings, Carbs |
| `teal`       | `#539EA6` | Info accent: Protein, within-target calorie bars, Normal BMI |
| `teal-deep`  | `#3D7B82` | Teal as text on cream |
| `red`        | `#BE3B2B` | Errors, over-target, destructive actions |

Brand gradient (SVG only): `#D65B26 → #EC8F3A` (the mark's flame). White text rides `flame` fills.
Modal backdrop: `rgba(58, 42, 27, 0.45)` (warm dim, not black).

## Semantic mappings

- **Macros:** Protein `teal` · Carbs `amber` · Fat `flame`.
- **Calorie status:** within target `teal` · near (≤115%) `amber` · over `red`. No green anywhere.
- **Day ring:** real SVG arc — track `sand-2`, progress = brand gradient while ratio ≤ 1, solid
  `amber` ≤ 1.15, solid `red` above. Number in the display face.

## Typography

Two faces, total:

- **Display: `Fraunces_600SemiBold`** (via `@expo-google-fonts/fraunces`, loaded in the root
  layout). Used ONLY through `src/components/display-text.tsx` (`<DisplayText>`), never via a raw
  `fontFamily` or a className. Where: screen titles, the day-header label, hero numerals (ring
  kcal, weight, BMI, daily target), the Sufra wordmark on Connect/sign-in.
- **Body: system** (SF Pro / Roboto) — everything else, weights medium/semibold/bold as today.

## Shape & components

- Cards: `rounded-2xl bg-card` directly on the cream — no border needed (contrast separates).
- Boxes inside a card/sheet: `rounded-xl bg-sand`.
- Buttons: pill (`rounded-[9999px] h-12`). Primary `bg-flame` + white semibold; secondary
  `border border-line bg-card text-ink`; destructive intent is `text-red` (text action, no red fill).
- Inputs: `border border-line bg-card`, ink text, `ink-faint` placeholder.
- Day strip: selected = `bg-flame` circle + white; today-unselected = `border border-flame`;
  future = `ink-faint`, no circle.
- Tab bar: cream background, sand indicator, flame selected label.
- Empty states: the basket mark (`@/assets/images/sufra-circle.png`, ~56px, ~50% opacity) above
  the copy, on a `bg-card` rounded panel.

## Motion stance

Native feel rides the platform (NativeTabs, Alert, RefreshControl, sheet slide). The only custom
motion: the existing splash fade and (optional, later) a one-time ring arc sweep. No scroll
reveals, no celebratory toasts — silent success.

## Pipeline discipline (unchanged, load-bearing)

- Every className must exist in a `global.css` `@source inline(...)` allowlist and every color in
  `@theme` — a missing class is a SILENT no-op. Audit after writing.
- `className` never reaches `SafeAreaView` (style prop: `Palette.cream`) nor react-native-svg
  elements (props only, from `Palette`).
- No `dark:`/state variants. Light is pinned (`userInterfaceStyle: "light"`).
