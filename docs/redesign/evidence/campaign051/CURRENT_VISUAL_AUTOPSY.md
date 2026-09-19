# Campaign 051 — Current Visual Autopsy

**Baseline SHA:** `2a1a0c38be80eb6e65a9105e8d1c22999611a66e`
**Observed:** 2026-09-19, source audit plus dedicated release before/after ADB capture
**Native baseline:** `VALIDATED` — the release artifact from the starting SHA was
installed on the dedicated QA emulator and compared with the restored final release.

## What the current product actually says

The implementation is disciplined and technically mature, but its visual
language is still the accumulated result of several incremental campaigns:

- **Home is a stack of decisions.** `ScreenShell` establishes a centered,
  scrolling column and Home renders a large neutral Today card, a context card,
  workout configuration, quick actions, spotlight/milestones, recent games,
  and history. The workout CTA is correctly first, but the surface rhythm is
  still “card after card”; there is no singular training object or memorable
  visual anchor.
- **Games has a recommendation card plus a repeated library grammar.** The
  route provides search, category chips, favorites, empty states, and a 42-game
  grid, but `GameCard` is a white/raised card with a thin domain ribbon,
  outlined identity mark, eyebrow, title, interaction copy, and optional badge.
  The identity system is semantically good but visually too small to make the
  library feel like a storefront of distinct worlds.
- **Detail and intro are neutral shared heroes.** Game Detail places an
  identity mark, category, title, mechanic copy, mastery ring, and Play button
  inside one rounded hero. GameHost does the same for the intro and keeps the
  domain cue in a small motif. The logic is excellent; the game fantasy is
  under-expressed.
- **Gameplay chrome is still a shell around the mechanic.** The shared host
  gives the session a compact HUD and pause path, but the shell has no strong
  stage framing or tactile console affordance. The mechanic modules carry most
  of the visual identity independently.
- **Results lead with facts before feeling.** `GameResults` renders a title,
  fact stack, optional badge, reward/confetti card, workout handoff, and a
  wrapped button row. It is correct and accessible but does not create a
  singular emotional peak or an obvious “what next?” hierarchy.
- **Progress is credible but visually dense.** The route contains careful
  explainability, domains, balance, activity, volume, trends, workouts, and
  per-game analysis. The neutral `Card` primitive and repeated metric blocks
  make the analytics feel like a dashboard rather than a calm training record.
- **Profile/Rewards are functional collection surfaces.** They already have
  ownership-safe reward actions, cosmetics, quests, achievements, and data
  management boundaries, but the visual hierarchy is mostly shared cards,
  pills, and rows. Collection can become more intentional without turning
  data management into arcade decoration.

## Geometry, palette, and interaction diagnosis

The current token file explicitly describes Campaign 026 “Neon Arcade”: warm
paper/deep plum, vermillion, volt/violet, eight domain colors, chunky rounded
geometry, large radii, pill controls, and card/elevation shadows. That is a
coherent foundation, but it produces the exact failure mode this reboot is
meant to correct: large rounded surfaces, soft elevation, and repeated pills
flatten the hierarchy. Every card feels like the same object; game identity is
mostly a 34–44 dp mark; and the strongest colors are often reserved for
semantic states rather than a focal visual world.

The current shared primitives also reveal the safest leverage points:

- `Card` owns surface, radius, border, and elevation for nearly every route.
- `Button` owns tactile lip/press feedback and can carry the new primary
  console-key treatment without changing callers.
- `Tappable` already centralizes touch target, reduced-motion press feedback,
  and sensory-gated haptics/audio.
- `ThemedText`, `ScreenShell`, `NativeTabs`, and the existing domain families
  are protected accessibility/layout seams and should be evolved, not bypassed.

## Native observation and before/after evidence

The valid baseline was built as a release APK from the exact starting SHA
`2a1a0c38be80eb6e65a9105e8d1c22999611a66e` in a disposable detached worktree.
The debug variant was intentionally excluded because it does not package the
Metro-free JavaScript bundle; the release build succeeded in 7m46s.

- Baseline release APK: 109,558,148 bytes,
  SHA-256 `DFD4C2A21ADF6388A7B2A5CC5C527680A6B45B11596E69578E7CB1C9B424C629`.
- Final release APK restored after the comparison: 109,576,793 bytes,
  SHA-256 `C91389622D7D90B58065550FC1F28A30D0086103D99A5956FDEA501667806A4C`.
- Device: dedicated `braintraining-ui35` / `emulator-5554`, Android 15/API 35,
  1080x2400; the separate `emulator-5556` target was not touched.
- Baseline real-pixel captures: `D:\Temp\campaign051-before-home-release.png`,
  `D:\Temp\campaign051-before-games-release.png`, and
  `D:\Temp\campaign051-before-game-detail-release.png`, with matching
  UIAutomator XML files beside them.
- Final real-pixel captures after reinstall: `D:\Temp\campaign051-after-home-release-restored.png`,
  `D:\Temp\campaign051-after-games-release-restored.png`, and
  `D:\Temp\campaign051-after-game-detail-release-restored.png`, with matching
  UIAutomator XML files beside them.

The direct comparison is substantive: baseline Home is a neutral white card
stack with no world-art anchor; final Home leads with the mint Focus Module
stage, a recognizable Next in Sequence identity, and one tactile workout
action. Baseline Games repeats white cards with small outlined marks; final
Games uses authored poster worlds, domain color, recommendation framing, and a
clear storefront hierarchy. Baseline Detail is a neutral white hero; final
Detail opens with the game board as a large identity object before the mechanic,
mastery, and Play action. The same emulator, route family, and Metro-free
release boundary were used for both sides.

## Reboot thesis

Retain the proven semantic/a11y/game-SDK foundations, but make the player see
one object first: a Signal Arcade console with a domain world, mechanic cue,
and one decisive action. Use code-native geometric art so the 42-game catalog
is scalable, and keep Progress/Data Management calm enough to earn adult trust.
