# Proposal — Campaign 024: Frontend UX Modernization

## Why

The product is functionally complete (42 games, offline-first SQLite core,
progression/rewards/streaks, release build verified) but its frontend does not
yet look or feel like the class of app the owner names as the bar (Duolingo,
Brilliant.org, Elevate). Campaign 023 added gamified *surfaces* (streak card,
level card, reward moment) on top of an unchanged visual language; the recon in
this packet shows the underlying problems are structural, not cosmetic:

- **Flat hierarchy.** Every Home/Progress/Profile slot is the same white
  `surface` card with the same radius and near-identical weight, so the daily
  workout CTA, streak, level and history all shout at equal volume. No surface
  has a hero metric; the largest element on Home today is an incidental `0`.
- **Underpowered actions.** The primary CTA is a pale `accentSoft` pill with
  accent-coloured text (~20 inline copies of it exist), so the primary action
  is visually weaker than the content around it.
- **Interaction vacuum.** Only `GameButton` animates on press. Shell screens
  use opacity-only `pressed` styles; nothing else in the app has press scale,
  press haptics, count-up numerals, staggered entrance, or state-transition
  feedback. Reanimated 4.5.1 and `react-native-worklets` are installed but
  unused; there is no motion spec beyond five duration numbers.
- **Dead responsive layer.** `useIsCompactWidth` / `useIsWideWidth` /
  `useClampedContentWidth` exist with **zero consumers**. `MaxContentWidth`
  is the only responsive behaviour in the app, so tablet and landscape are
  untested and unadapted.
- **Accessibility gaps.** ~25 interactive elements lack roles/labels/hints;
  the brand accent fails WCAG AA as text on surface in both themes
  (light 3.8:1, dark 3.9:1); two Code Cracker pegs are 40 dp with no hitSlop;
  the font-scale cap (1.35) hides layout fragility instead of fixing it.
- **Colour-as-decoration.** Fixed hex and `rgba()` literals outside the token
  layer, including dark-mode-broken fills (`rgba(120,120,255,0.8)`,
  `rgba(0,122,255,0.12)`, `rgba(128,128,128,0.25)`); no semantic identity colour
  per domain or per metric, so charts and cards cannot be read at a glance.
- **Unverifiable visually.** No runtime visual evidence exists: 023 recorded
  "screencap returns a constant blank frame" and could not capture a single
  screenshot. This campaign created a GPU-enabled capture AVD and proved
  `screencap` returns real pixels, so visual claims become measurable.

## What changes

1. **Design language v2** — token layer with contrast-verified semantic colour,
   metric/domain identity colours, elevation ramp, numeral/eyebrow typography
   tokens, motion spec (durations, springs, stagger), and breakpoint tokens.
2. **UI kit** — real primitives (`Button`, `Card`, `Chip`, `Badge`,
   `ProgressBar`, `ProgressRing`, `AnimatedNumber`, `StatBlock`, `ListRow`,
   `EmptyState`, `Skeleton`, `TextField`, `ScreenHeader`, `Avatar`, `Toast`,
   `Tappable`) replacing ~20 inline CTA copies, ~10 hairline-literal sites, and
   the unused `StatTile`/`FeedbackCard`/`A11yDialog` leftovers.
3. **Screen hierarchy** — every user-facing surface restructured around one
   hero metric, one primary action, and reference-grade section anatomy
   (Games, Game detail, Home, Progress ×4, Results, Rewards, Profile, Data
   management, game host chrome).
4. **Micro-interactions** — press feedback + haptics on all interactives,
   count-up numerals, staggered entrance, answer-feedback choreography,
   results celebration with personal-best detection, streak beat.
5. **Responsive layout** — real breakpoint consumption, adaptive grids and
   two-column expanded layouts, safe-area correctness, font-scale-safe
   wrapping, landscape/tablet evidence on the capture AVD.
6. **Accessibility** — AA contrast for every text/UI pairing (both themes),
   roles/labels/hints/states on all interactives, ≥44 dp targets, complete
   `prefersReducedMotion` coverage, screen-reader flow and heading order.
7. **Verification** — Jest/tsc/lint matrix, native screenshot evidence per
   surface (light + dark), contrast assertions in tests, autobot canaries for
   runtime regression, and a written before/after visual record.

## Out of scope

New games, gameplay/mechanics changes, scoring/rating/progression semantics,
persistence formats, sync/cloud/AI/monetization, store signing, iOS runtime,
notification/widget systems, and any change to the locked product decisions in
`docs/PROJECT_CONSTITUTION.md`. Game *logic* files are untouched except where a
defect blocks a required interaction contract (e.g. a sub-44 dp target).

## Exit gate

Every spec scenario in this change is satisfied with recorded evidence, the
full matrix is green, native before/after screenshots exist for every surface
in both themes, and `.agent/VALIDATION.md` records honest PASS / NOT VALIDATED
classifications for anything the host cannot exercise.
