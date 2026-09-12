# Tasks — Campaign 026: Visual Identity Rebuild

## Phase 0 — Activation

- [x] OpenSpec packet created; governance/state/ownership rebound; validators PASS.
- [x] Pre-redesign baseline captures on emulator-5560 (`qa-artifacts/campaign026/before/**`).
      Six frames (home/games/game-detail/game-intro × light/dark) were black
      from the pre-restart emulator surface and regenerated from `6f420cc` into
      `qa-artifacts/campaign026/before-recovery/**`, merged into the baseline
      manifest with `regeneratedFrom` notes.

## Phase 1 — Identity foundation (orchestrator-owned)

- [x] `theme/tokens.ts` rebuilt: new light/dark palettes, semantic families,
      domain identities, metric colours, typography, radii, motion, elevation.
- [x] `theme/contrast.ts` + `theme/__tests__/contrast.test.ts` updated to the
      new pairings (real WCAG math; no weakened thresholds) — 16/16 PASS.
- [x] Global hardcoded-colour sweep across shell/routes/kit (only tokens ship):
      added `Depth` + overlay neutral slots; game stimulus palettes documented
      as the sanctioned exception.

## Phase 2 — Kit rebuild (orchestrator-owned shared surface)

- [x] `components/ui/**` restyled: Tappable/Button (lip), Card (hero/soft),
      Chip, Badge, ProgressBar/Ring, AnimatedNumber, StatBlock, ScreenHeader,
      SegmentedControl, Entrance, ListRow, EmptyState, Skeleton, Toast,
      Avatar, TextField, IconButton, SectionGrid, BackLink.
- [x] New identity primitives with contracts + tests: `Spark`, `Confetti`,
      `StreakStrip` (`components/ui/__tests__/spark.test.tsx`; kit suites 47
      PASS).

## Phase 3 — Shell and routes (parallel packets)

- [x] Home + Games library + game detail recomposed (hero loop, catalog grid,
      single-path resume block).
- [x] Progress suite (charts as identity cards, insight pairs, dot calendar).
- [x] Profile + Rewards + Data management (badge gallery, hero metric grid,
      designed empty states, claimable vs in-progress vs locked).
- [x] Results + workout + spotlight/mastery/discovery surfaces.
- [x] Tab bar / screen shell / app chrome on the new language (filled-lozenge
      active tab; label visibility corrected for accent text).

## Phase 4 — Game experience

- [x] Game chrome restyle: intro hero, session HUD (exit · segmented progress ·
      pause), round results; verdict vocabulary preserved.
- [x] Celebration moments: confetti, spark, streak beat, level-up beat.

## Phase 5 — Verification

- [x] Full matrix at `3f01a01`: Jest 536 suites / 6412 tests PASS (4 suites /
      5 tests allowlisted skips), `tsc` clean, `expo lint` clean.
- [x] a11y audit 0 violations across 22 surfaces (both themes); clipped
      viewport nodes reported separately, never counted as violations.
- [x] Autobot canaries 8/8 PASS; daily-workout journey PASS (4/4 + relaunch
      shows persisted completion).
- [x] After captures: 22 frames mirroring the baseline set in both themes;
      baseline completed with 6 regenerated frames.
- [x] Release artifact rebuilt from the campaign head: 109,496,133 bytes,
      SHA-256 `2E89B783495EFE66D1EAD57FCBE487AF60A79E245C22A69558A6027B94D36EC4`.
- [x] Durable state + `docs/DESIGN_SYSTEM.md` updated; campaign closed with
      honest classifications.
