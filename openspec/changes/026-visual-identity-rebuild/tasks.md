# Tasks — Campaign 026: Visual Identity Rebuild

## Phase 0 — Activation

- [x] OpenSpec packet created; governance/state/ownership rebound; validators PASS.
- [ ] Pre-redesign baseline captures on emulator-5560 (`qa-artifacts/campaign026/before/**`).

## Phase 1 — Identity foundation (orchestrator-owned)

- [ ] `theme/tokens.ts` rebuilt: new light/dark palettes, semantic families,
      domain identities, metric colours, typography, radii, motion, elevation.
- [ ] `theme/contrast.ts` + `theme/__tests__/contrast.test.ts` updated to the
      new pairings (real WCAG math; no weakened thresholds).
- [ ] Global hardcoded-colour sweep across shell/routes/kit (only tokens ship).

## Phase 2 — Kit rebuild (orchestrator-owned shared surface)

- [ ] `components/ui/**` restyled: Tappable/Button (lip), Card (hero/soft),
      Chip, Badge, ProgressBar/Ring, AnimatedNumber, StatBlock, ScreenHeader,
      SegmentedControl, Entrance, ListRow, EmptyState, Skeleton, Toast,
      Avatar, TextField, IconButton, SectionGrid, BackLink.
- [ ] New identity primitives where needed (celebration, spark mark, hero
      metric) with contracts + tests.

## Phase 3 — Shell and routes (parallel packets)

- [ ] Home + Games library + game detail recomposed (hero loop, catalog grid,
      single-path resume block).
- [ ] Progress suite (charts as identity cards, insight pairs, dot calendar).
- [ ] Profile + Rewards + Data management (badge gallery, hero metric grid,
      designed empty states, claimable vs in-progress vs locked).
- [ ] Results + workout + spotlight/mastery/discovery surfaces.
- [ ] Tab bar / screen shell / app chrome on the new language.

## Phase 4 — Game experience

- [ ] Game chrome restyle: intro hero, session HUD (exit · segmented progress ·
      pause), round results; verdict vocabulary preserved.
- [ ] Celebration moments: confetti, spark, streak beat, level-up beat.

## Phase 5 — Verification

- [ ] Full matrix: Jest, tsc, lint, all validators.
- [ ] a11y audit 0 violations; autobot canaries 8/8; daily-workout journey.
- [ ] After captures: same surfaces/themes/profiles as the baseline; owner
      before/after comparison set.
- [ ] Release artifact rebuilt from the campaign head.
- [ ] Durable state + `docs/DESIGN_SYSTEM.md` updated; campaign closed with
      honest classifications.
