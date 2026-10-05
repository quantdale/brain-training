# Design System — "Training Studio" (change 076)

This document describes the visual language the app **currently ships**. Its
concrete values — radii, motion durations, and the palette hexes — are not a
prose summary: `apps/mobile/src/components/__tests__/design-system-doc.test.ts`
asserts every value stated below against the token source, so a token change
fails that suite until this document is updated with it. If a number here and a
number in `theme/tokens.ts` ever disagree, the tokens win and this file is
stale.

Lineage: Campaign 026 established the arcade direction; Campaigns 051-055
shipped "Signal Arcade"; change 076 selected the "Training Studio" system from
three on-device prototypes and re-authored the token values in place (same
token shape, new values; see
`openspec/changes/076-product-wide-ui-ux-reboot/evidence/REFERENCE_LOCK.md`).
Tokens live in `apps/mobile/src/theme/tokens.ts`; the palette is
contrast-verified by `theme/__tests__/contrast.test.ts` and the lock values
are pinned by `theme/__tests__/reference-lock.test.ts`.

## 1. Visual thesis

**Quiet studio, immersive play.** A calm studio shell — warm paper in light
mode, near-black in dark mode — wrapped around an immersive charcoal stage
where the mechanic owns the screen. ONE red primary action per viewport;
success/error always carry text + icon/shape beyond color; reports read as
instruments, never dashboards. Celebration is staged and bounded, never
decorative noise.

## 2. Colour

Every family exposes five slots, and both semantic families and domain
identities are flattened into the theme key space (e.g. `theme.memory`,
`theme.memorySoft`, `theme.memoryText`):

| Slot | Role | Floor |
|---|---|---|
| `base` | filled surfaces (buttons, chart fills, badges) | 3:1 vs surface |
| `text` | the family as text on surface/background | 4.5:1 |
| `soft` | tinted background for cards/chips/rows | — |
| `softText` | text drawn on `soft` | 4.5:1 |
| `on` | text/glyph drawn on `base` | 4.5:1 |

- **Light "studio paper":** warm paper background `#F7F6F3`, white card
  surface `#FFFFFF`, warm-gray borders `#D8D5CE`, ink `#17181A`, secondary
  ink `#4A4B4E`, muted `#6E6E68`.
- **Dark "studio stage":** near-black background `#101114`, charcoal stage
  surface `#1B1D21` (raised `#232629`), border `#34363B`, off-white text
  `#F2F2F0`, secondary `#B9BABC`, luminous family fills with dark `on`
  colours.
- **Primary action:** CTA red (`#D6293A` light / `#FF4A57` dark) - the ONE
  primary action fill per viewport. Pressed state uses `accentStrong`
  (`#B01E2E` light / `#FF6E79` dark). Red is never the error family and
  never a generic accent: success (`#157A46`/`#4CC98A`) and error
  (`#A32014`/`#FF7B67`) carry text+icon/shape on their soft grounds.
- **Metric identities (fixed, never reassigned):** XP violet, streak orange,
  currency amber, time blue, accuracy green, score accent.
- **Domain identities (8):** attention orange, flexibility violet, language
  sky, logic teal, math blue, memory pink, spatial green, speed yellow. Every
  category surface (library, charts, mastery, game intro) uses the same hue.

## 3. Typography

System stack, hierarchy capped at weight 800, tabular numerals for every
metric. Scale: eyebrow 11.5 (uppercase, tracking 1.8) - caption 12 - label
13/700 - bodySmall 14 - body 16 - bodyLarge 17/600 - headline 24/800 - title
30/800 - display 40/800 - numeral 20/800 - numeralLg 30/800 - numeralXl
54/800 (result score). All numeral styles are tabular so counters never
reflow.

## 4. Geometry, elevation and the button lip

Radii: extraSmall 4 · small 8 · medium 12 · large 16 · extraLarge 22 · pill 999.
pill 999. Pills are reserved for chips. Cards carry a 1.5 px hairline border;
separation in dark
mode comes from value, not shadow. Elevation is a quiet monotonic ramp
(`flat - card - raised - hero - overlay`): cards are flat (border only),
only the stage card and primary CTA lift (`raised`), overlays stay highest.

## 5. Motion

`Motion`: press 90 · quick 140 · base 220 · entrance 280 · hero 340 · celebration 700 · stagger 60 · travel 14. Springs: `press` snappy, `progress`
settling, `hero` soft. Entrance transitions stagger by index. Every decorative
animation collapses under reduced motion (`usePrefersReducedMotion`), including
confetti, which renders no pieces when motion is reduced.

## 6. Kit (`@/components/ui`)

`Tappable`, `Button` (lip), `IconButton`, `Card` (plain/outlined/raised/hero,
family `tone`), `SectionGrid`, `BackLink`, `Entrance`, `Chip`, `Badge`,
`ListRow`, `EmptyState`, `Skeleton`, `TextField`, `ToastHost`, `ProgressBar`,
`ProgressRing`, `AnimatedNumber`, `StatBlock`, `SegmentedControl`, plus
identity primitives `Spark` (mark), `Confetti` (deterministic, margins-only,
reduced-motion aware) and `StreakStrip` (day dots + count pill). The kit owns
press feedback, haptics, 44 dp floors, token discipline and accessibility
defaults.


## 7. Composition rules

- One hero per screen; one primary action per viewport.
- Section headers read "title left + action right" ("See all").
- Streak is a day-dot strip + count pill, never a text row.
- Achievement states are three distinct treatments: claimable (action button),
  in-progress (meter), locked (desaturated badge).
- Empty states are designed: mark → headline → one line → bottom-anchored CTA.
- Results are celebration-first: outcome headline + hero metric, then equal
  metric columns, then one CTA; celebration is a separate beat, never merged
  into the CTA row.
- Tab bar: filled lozenge active state, labels always visible, five
  destinations max.

## 8. Accessibility

Contrast: WCAG AA (4.5:1 body, 3:1 large/UI) asserted for every semantic and
domain pairing in both schemes. Interactive targets ≥ 44 dp (`MIN_TOUCH_TARGET`, the single canonical constant
in `@/components/a11y`; a second definition of it fails the kit contract test). Reduced motion
and font-scale-2 remain first-class and are exercised by the kit contract tests
and native capture profiles.

## 9. Adding to the system

Add tokens in `theme/tokens.ts` (both schemes), assert new pairings in the
contrast test, and compose screens from kit primitives + tokens only —
hardcoded colours or one-off controls are defects. Gameplay, scoring,
generators, persistence and every existing testID are outside the design
system's ownership: restyle the skin, never the mechanics.

## 10. Changelog

- **Change 071 (2026-09-30).** Removed as unreachable: `Avatar`,
  `ScreenHeader`, `LevelCard`, `StreakCard` and `ResultRow` (the last superseded
  by `StatRow`, which shares its file). The two "game card" shapes were
  superseded by `GamePosterTile`. Recoverable from git history at the removing
  commit; re-add only with a real caller, because a documented-but-absent
  component sends the next author looking for an import that does not exist.
- **Change 071 (2026-09-30).** This document's concrete values are now asserted
  against `theme/tokens.ts` by
  `apps/mobile/src/components/__tests__/design-system-doc.test.ts`, and the
  palette/radii/motion values above were corrected to the shipped tokens. The
  44 dp floor has a single canonical constant (`MIN_TOUCH_TARGET` in
  `@/components/a11y`); the duplicate theme export and the platform literal were
  removed.
