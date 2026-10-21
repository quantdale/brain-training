# Design System — "Play Lab" (change 077)

This document describes the visual language in the current app source. Campaign
077 implementation and native acceptance landed and are validated (Campaigns
077 and 078 are closed; see `.agent/STATE.md`). Its
concrete values — radii, motion durations, and the palette hexes — are not a
prose summary: `apps/mobile/src/components/__tests__/design-system-doc.test.ts`
asserts every value stated below against the token source, so a token change
fails that suite until this document is updated with it. If a number here and a
number in `theme/tokens.ts` ever disagree, the tokens win and this file is
stale.

Lineage: Campaign 026 established the arcade direction; Campaigns 051-055
shipped "Signal Arcade"; change 076 introduced "Training Studio". Change 077
selects "Play Lab" after actual Refero research, three generated directions and
independent critique. The current lock is
`openspec/changes/077-frontier-product-experience-rebuild/evidence/ART_DIRECTION.md`.
Tokens live in `apps/mobile/src/theme/tokens.ts`; the palette is
contrast-verified by `theme/__tests__/contrast.test.ts` and the lock values
are pinned by `theme/__tests__/reference-lock.test.ts`.

## 1. Visual thesis

**A clear learning space with playful objects.** Cool canvas, humanist Manrope
type, blue actions and original matte learning-toy illustrations establish the
shell. Quiet navy stages give each mechanic room. Artwork supports discovery
and introductions; essential stimuli, rules and answers remain native text and
geometry. One primary action leads each viewport. Success/error carry text and
shape beyond color; celebration stays short and bounded.

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

- **Light:** cool canvas `#F6F7FB`, white card surface `#FFFFFF`, borders
  `#DCE2EC`, ink `#17243B`.
- **Dark:** navy canvas `#0D1728`, card surface `#172132`, border `#34445D`,
  off-white ink `#F3F6FC`. Luminous family fills use their dark `on` ink.
- **Primary action:** blue (`#0061EF` light / `#8DBBFF` dark), paired with
  `accentOn`. Pressed state uses `accentStrong` (`#004FC7` / `#B2D2FF`).
  Success (`#157A46`/`#4CC98A`) and error (`#A32014`/`#FF7B67`) retain
  separate semantics and carry text/shape on their soft grounds.
- **Metric identities (fixed, never reassigned):** XP violet, streak orange,
  currency amber, time blue, accuracy green, score accent.
- **Domain identities (8):** attention orange, flexibility violet, language
  sky, logic teal, math blue, memory pink, spatial green, speed yellow. Every
  category surface (library, charts, mastery, game intro) uses the same hue.

## 3. Typography

Bundled Manrope 400/600/700 works offline on native and web. Scale: eyebrow
12/600 (tracking 0.6), caption 12/400, label 13/600, bodySmall 14/400, body
16/400, bodyRead 16/26, bodyLarge 17/600, headline 22/700, title 28/700,
display 36/700, gameTitle 21/700, resultHeadline 28/700, numeral 20/700,
numeralLg 28/700 and numeralXl 48/700. Numerals use tabular advance. Essential
copy may grow and wrap; decorative media yields space at compact/large-font
breakpoints. Native font names and weights are embedded through Expo-font.

## 4. Geometry, elevation and the button lip

Radii: extraSmall 4 · small 8 · medium 8 · large 12 · extraLarge 16 · pill 999.
Pills mark actions and selected chips; content cards use quieter corners.
Cards carry a 1.5 px hairline border;
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

`Tappable`, `Button` (lip), `IconButton`, `AppIcon` (Lucide public per-icon
imports), `Card` (plain/outlined/raised/hero, family `tone`), `ArcadePanel`,
`Report`, `ReportRow`, `SectionGrid`, `BackLink`, `Entrance`, `Chip`, `Badge`,
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
hardcoded colours or one-off controls are defects. Preserve existing testIDs
and persistence contracts. Mechanics repairs belong to explicit game packets,
with real caller regressions and versioned rules; a visual edit alone does not
authorize scoring changes.

## 10. Changelog

- **Change 077 (2026-10-14).** Replaced the shell palette/type/radius direction
  in place, embedded offline Manrope, introduced one Lucide vector family and
  integrated original local illustrations/branding. Actual native preview and
  independent critique are recorded in the active change; full screen/game
  convergence and certification remain open.

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
