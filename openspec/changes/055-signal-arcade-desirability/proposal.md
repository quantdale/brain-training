## Why

Campaign 054 closed the repository-owned technical gaps; the remaining problem
is desirability. Campaign 051 established a recognizable Signal Arcade visual
language and Campaign 052's acceptance evidence showed that its strongest idea
is not equally dominant across the experience: several surfaces still read as a
gamified dashboard, game fantasy is weaker than game explanation, Results reads
as a report, Profile reads as record management, Rewards reads as inventory,
and the shell looks more considered than the games. The catalog is technically
excellent but not yet desirable.

## What Changes

- Lock a refinement contract (`REFINEMENT_LOCK.md`) that preserves Signal
  Arcade and defines container, typography, shape, colour, result, game-world,
  Profile, Rewards, Progress and dark-mode roles.
- Add shared visual primitives for those roles (Stage, Panel, Report, Slot)
  instead of per-screen hacks, and differentiate typography voices.
- Rebuild Games discovery as an art-first storefront: featured stage + poster
  grid, identity before metadata, no repeated banner→badge→title→paragraph
  stack.
- Rebuild Results (in-session and route) around one emotional artifact with an
  honest performance band, factual completion and reward statements, and an
  unmistakable action hierarchy.
- Recompose Profile as player identity first and record management second;
  Rewards as a collectible grid with clear owned/equipped/locked states.
- Reduce Home to one dominant daily object, refine Game Detail toward
  game-world pull with secondary records, and soften Progress toward a
  credible training narrative rather than analytics software.
- Refine tutorial pacing and gameplay chrome/feedback visually without
  touching any mechanic, and repair observed dark-mode tonal separation.
- Audit and repair visible product copy (internal vocabulary, duplicate
  statements, raw debug numbers, placeholder identity language).

## Must Not Change

- Game mechanics, scoring, timers, generators, difficulty, the 42 registry IDs,
  workout semantics, XP, currency, reward economy, migrations, persistence
  semantics, schema v12, backup/import/export, offline behaviour.
- Router architecture, testID contracts, accessibility semantics, opt-in
  probes, the unexpected-console gate, bootstrap recovery, route envelope.
- Signal Arcade's palette hues, domain identities, code-native world system,
  console-key actions or authored dark mode.
- No IQ/brain-age/intelligence/medical/unsupported-transfer claims, no social
  features, no monetization, no generated raster production art.
