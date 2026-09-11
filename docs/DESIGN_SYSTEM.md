# Design System

Single reference for the app's visual language, the shared UI kit, and the
rules screens follow. Tokens live in `apps/mobile/src/theme/tokens.ts`; the kit
lives in `apps/mobile/src/components/ui/`. Both are authoritative — a screen
that hardcodes a colour, a size or an animation duration is out of contract.

Campaign 024 rebuilt this layer ("Playful Precision": clarity first like
Elevate, energy second like Duolingo/Brilliant). The reference research behind
the choices is committed at
`openspec/changes/024-frontend-ux-modernization/research/`.

## 1. Colour

Every family exposes five slots, so callers pick a slot instead of guessing
contrast:

| Slot | Use | Contract |
|---|---|---|
| `base` | filled surfaces: buttons, chart fills, badges | ≥3:1 vs `surface` |
| `text` | the family used as text on `surface`/`background` | ≥4.5:1 |
| `soft` | tinted background: cards, chips, rows | — |
| `softText` | text drawn on `soft` | ≥4.5:1 vs `soft` |
| `on` | text or glyph drawn on `base` | ≥4.5:1 vs `base` |

Families: `accent`, `success`, `warning`, `danger`, `info`, `streak`, `xp`,
`currency`, plus eight domain identities in `DomainColors` (memory, attention,
speed, math, language, logic, flexibility, spatial).

Rules:

- **Metric identity is fixed.** XP is always violet, streak orange, time sky,
  accuracy green, currency teal, score accent (`METRIC_COLOR_KEYS`). A screen
  may own a *domain* colour; it may not re-hue a shared metric.
- **Dark mode inverts the fill strategy.** Dark fills are luminous and carry
  dark text (`*On` = near-black); light fills carry white text. Never hand-pick
  the on-colour — read the slot.
- **No literals.** `theme/__tests__` enforces this over screens and components.
  `border` is a decorative hairline; use `borderStrong` (≥3:1) when the border
  is the only affordance (inputs, toggles).

`theme/contrast.ts` computes WCAG ratios and
`theme/__tests__/contrast.test.ts` asserts every pairing in both schemes.

## 2. Typography

`Typography` steps (size / line-height / weight, with tracking and tabular
figures where relevant): `eyebrow`, `caption`, `label`, `bodySmall`, `body`,
`bodyLarge`, `headline`, `title`, `display`, `numeral`, `numeralLg`,
`numeralXl`.

Use `ThemedText type="…"`; no raw `fontSize` in screens.

- One display/hero style per screen (the hero metric).
- `numeral*` styles are tabular: animated counters cannot reflow layout.
- Dynamic type is capped per role (`components/a11y/font-scale.ts`): reading
  copy scales to 2.0, headings 1.6, hero 1.4; board glyphs opt out with
  `allowFontScaling={false}`. Layouts must wrap, not clamp.

## 3. Spacing, shape, elevation

- `Spacing` (4 dp base): `half 2`, `one 4`, `oneHalf 6`, `two 8`, `twoHalf 12`,
  `three 16`, `threeHalf 20`, `four 24`, `five 32`, `six 64`.
- `Radii`: `extraSmall 6`, `small 8`, `medium 12`, `large 20` (cards),
  `extraLarge 28` (hero cards), `pill`.
- `Elevation` is a monotonic ramp: `none`/`flat` (grouped content), `card`
  (default), `raised` (one per region), `hero` (the screen's hero),
  `overlay` (modals). Two adjacent surfaces must not both be `raised`.

No ad-hoc values: a new need means a new token, or an existing one.

## 4. UI kit (`@/components/ui`)

| Primitive | Purpose |
|---|---|
| `Tappable` | the pressable contract: press scale, sensory-gated haptics, ≥44 dp target, default button role |
| `Button` | variants `primary`/`secondary`/`ghost`/`danger`/`success`; sizes `sm`/`md`/`lg`; loading/disabled blocking; dual-line CTA (`label` + `sublabel`) |
| `Card` | roles `plain`/`outlined`/`raised`/`hero` + `tone` tint; pressable variant |
| `SectionGrid` | 1→2→3 column adaptive section flow |
| `ProgressBar`, `ProgressRing`, `AnimatedNumber`, `StatBlock` | meters, hero rings, count-ups, metric blocks |
| `Chip`, `Badge`, `ListRow`, `EmptyState`, `Skeleton`, `Avatar` | library, lists, loading and empty states |
| `TextField`, `SegmentedControl`, `IconButton`, `ScreenHeader` | input and navigation chrome |
| `Toast`/`ToastHost` | non-blocking confirmations |

Kit invariants (enforced by `components/ui/__tests__/kit-contract.test.tsx`):

- disabled/loading blocks the action,
- every control has a role and a non-empty accessible name,
- every control reaches 44×44 dp (layout or `hitSlop`),
- press feedback never delays `onPress`, and collapses under reduced motion.

Game chrome adapts the same primitives: `GameButton` is a thin adapter over
`Button`, so games inherit the contract without per-game copies.

## 5. Motion

Durations (`Motion`): `press 90`, `quick 140`, `base 200`, `entrance 260`,
`hero 320`, `celebration 650`, `stagger 60`, `travel 12`. Springs (`Springs`):
`press`, `progress`, `hero`.

Rules:

- Motion is feedback, never decoration that delays input.
- Every animation is interruptible and bounded; celebrations ≤1.5 s and never
  cover text or controls.
- Reduced motion collapses to the end state (`usePrefersReducedMotion`).
- Celebrations are earned: personal best, level-up, streak milestone, perfect
  score. Routine completions get the quiet completion treatment.

## 6. Layout and responsiveness

`Breakpoints`: compact <480, medium 480–767, expanded ≥768. Consumed through
`@/platform/layout`: `useLayoutTier`, `useScreenGutter`, `useGridColumns`,
`useContentMaxWidth`, `useAdaptiveValue`, plus the single-purpose
`useIsCompactWidth`/`useIsWideWidth`/`useClampedContentWidth`/`useWindowWidth`.

- `expanded` may split sections into two columns and grids into more columns.
- Content width: 800 dp phone-first, 960 dp wide; always centered.
- Content clears the status bar, tab bar, keyboard and gesture bar at every
  orientation; the last row of a scrollable surface is fully reachable.

The layout API must not rot: a sweep test fails when a declared hook has no
consumer (pending hooks are tracked in `theme/__tests__/responsive-consumers.ts`).

## 7. Accessibility

- Contrast: AA everywhere, asserted by test (see §1).
- Every interactive element: role + accessible name + state where applicable.
- Charts and visual encodings expose a textual summary via `accessibilityLabel`.
- Modals isolate the accessibility tree and announce on open; decorative art is
  hidden (`importantForAccessibility="no-hide-descendants"`).
- Haptics/sound always route through the sensory service so the global toggles
  and reduced-motion preference are honoured.

## 8. Surface hierarchy

One hero and one primary action per surface:

| Surface | Hero | Primary action |
|---|---|---|
| Home | daily-workout goal (ring + streak strip) | Start/Continue workout |
| Games | featured/recommended card + library | Open game |
| Game detail | mastery ring + personal best | Play |
| Progress | composite hero (ring + trend) | Drill into domain |
| Results | score hero + reward | Play again |
| Rewards | claimable count hero | Claim |
| Profile | identity hero (avatar + level + XP) | Equip/claim |
| Data management | storage summary | Export |
| Game intro | game name + category eyebrow | Start |
| Game session | round/timer/score HUD | Answer |
| Game results | celebration + metric row | Play again |

## 9. Adding to the system

1. Prefer an existing token/primitive; if none fits, extend the token layer
   first and the kit second — never a screen-local variant.
2. Any new colour pairing needs a contrast test entry (both schemes).
3. Any new interactive element inherits `Tappable`; do not re-implement press
   physics, haptics or target sizing.
4. Update this document when a contract (not a value) changes.
