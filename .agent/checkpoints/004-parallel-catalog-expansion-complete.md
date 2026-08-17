# Campaign 004 — Parallel Catalog Expansion: COMPLETED

**Completed:** 2026-08-17
**Commits:** `90a2da9` (wave1: 4 games + registry), `69fc2f5` (wave2: 4 games + registry)

## Exit criteria

| Criterion | Status | Evidence |
|-----------|--------|----------|
| 8 new games merged | PASS | 8 game directories under `src/games/`, 103 + 105 files |
| Each game registered | PASS | `registry.generated.ts` contains all 16 games; `--check` clean after regen |
| Each game tested (full-session coverage) | PASS | 7–8 test suites per game, deterministic seeded generators, reducer/scoring/session/screen smoke |
| Playable on emulator | PASS | Workout picks from expanded catalog; game screens render with correct testIDs |
| 16-game catalog verified end-to-end | PASS | Home workout shows campaign-004 games (Card Sort, Transform Match, Tap Rush, Missing Operator) |
| No unresolved Critical/High defect | PASS | No Critical or High findings during implementation |
| Parity matrix updated | PASS | 8 domain rows now show 2 games each |
| Committed docs/state match reality | PASS | STATE, VALIDATION, KNOWN_ISSUES, PARITY_MATRIX updated |
| Clean `main` pushed | PASS | `69fc2f5` on `origin/main` |

## Games implemented (8 new, 2 per domain)

| # | Game ID | Domain | Mechanic | Test Suites | Tests |
|---|---------|--------|----------|-------------|-------|
| 1 | attention-odd-one-out | Attention | Find the odd tile in a grid | 7 | 90 |
| 2 | speed-tap-rush | Speed | Rapid serial response, tap targets before expiry | 7 | 88 |
| 3 | memory-sequence-memory | Memory | Time-bounded Simon-style score attack | 7 | 90 |
| 4 | math-missing-operator | Math | Solve arithmetic by finding the missing operator | 8 | 72 |
| 5 | language-word-scramble | Language | Unscramble letters, category hints | 6 | 82 |
| 6 | logic-code-cracker | Logic & Problem Solving | Mastermind-style deduction | 6 | 91 |
| 7 | flexibility-color-stroop | Flexibility | Classic Stroop with rule-flip events | 7 | 74 |
| 8 | spatial-transform-match | Spatial | 2D grid pattern + transform label | 7 | 96 |

**Total new:** 55 suites / 683 tests
**Total repo:** 149 suites / 1755 tests

## Convergence issues found and fixed

1. **visual-baselines tsc error** (pre-existing from campaign 003): `renderRouter({ index: Screen })` with bare `ComponentType` failed `MockContextConfig` type check. Fixed by wrapping: `index: () => <Screen />`.
2. **speed-tap-rush Playfield width reset**: Playfield unmounts during `roundResult` phase and remounts in next `active` phase with `width=0`, silently ignoring all taps. Fixed in test by re-calling `setFieldSize` at the start of each round.
3. **speed-tap-rush score assertion**: Test expected `Score 0` after hitting remaining targets in a failed round, but hits earn points. Fixed to expect `Score 1350` (9 × 150).

## Validation summary

- `npx tsc --noEmit`: PASS (0 errors)
- `npx jest`: PASS (149 suites / 1755 tests / 4 snapshots)
- `node scripts/generate-game-registry.mjs`: PASS (16 games, categories validated)
- `node scripts/validate-repo-state.mjs`: PASS
- Emulator smoke (AVD `braintraining35`): PASS — workout shows campaign-004 games, Tap Rush game screen loads with all testIDs

## Notes for future campaigns

- The Playfield width-reset pattern (unmount during roundResult, remount in active) is a common test pitfall. Any game with this pattern must re-fire the layout event each round.
- Cross-game code duplication (seedToNumber, versionToNumber) is acceptable per constitution (no cross-game imports) but is a future SDK extraction candidate.
- iOS build remains NOT VALIDATED (Windows host).
