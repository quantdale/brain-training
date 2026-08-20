# Campaign 006R — Core Integrity Correction: COMPLETED (with honest NOT VALIDATED emulator gates)

**Completed:** 2026-08-20
**Final SHA (integration):** `f6aad97` (integration/pw01-final-convergence)
**Base SHA:** `df68b6f` (main at convergence start)
**Status:** IMPLEMENTED + VALIDATED for all non-emulator gates; emulator-gated gates honestly NOT VALIDATED (environment-blocked, never faked green)

## Exit criteria (from `openspec/changes/006r-core-integrity-correction/tasks.md`)

| Task | Status | Evidence |
| ------ | -------- | ---------- |
| 0.1-0.5 Baseline repair | PASS | typecheck 0 errors, repo-state PASS, Jest 239/2727 green, registry/provenance/ownership PASS, web export PASS, Expo Doctor 21/21 before convergence |
| 1.1-1.8 Progression/rating authoritative outcome | PASS | lowercase `DifficultyLevel`, `expectedPerformanceFromChallenge`, `challengeRating` persisted, `CompletionOutcome` with `ratingAfter`, authoritative XP display across 24 games, cross-subsystem tests, Easy farming protection |
| 2.1-2.6 Content provenance | PASS | 24 games inventoried, `contentVersion` standardized, persisted provenance, deterministic replay snapshots, CI validator with allowlist |
| 3.1-3.5 Word Match semantic correction | PASS | contentVersion 2.0.0, exactly-one-synonym validator, ambiguity tests green |
| 3.6 Emulator smoke | NOT VALIDATED | No AVD on this host for required on-device multi-round/tier smoke; Word Match logic validated via Jest content-validation + generator tests |
| 4.1-4.6 Equation Builder solvability | PASS | shared evaluator, all-difficulty property sweep, tutorial demo legal grammar, generator version bump |
| 5.1-5.5 Tutorial persistence | PASS | persistent store keyed by gameId+version, replay explicit, all 24 games use shared lifecycle |
| 6.1-6.7 Daily Workout persistence + personalization | PASS | durable `workout_instances`, `advance()` wired via `useWorkoutResultAdvance` with `shouldAdvanceWorkout` guard, personalization from full catalog, reroll transactional, deterministic tests |
| 6.8 AVD journey | NOT VALIDATED | Cross-feature trigger implemented and unit-tested (`advance.test.ts` 12 tests), Home marks Done/Now via `workoutChanged` event; full 4/4 + restart/resume AVD journey not driven this wave (requires AVD + Metro) — AVD `CRBABot_API_36` previously proved foreground + testIDs, but full workout journey remains for next hardening pass |
| 7.1-7.7 Economy transactionality | PASS | `spendCurrency` transactional, streak purchase atomic, quest/achievement claims atomic/idempotent, reroll atomic, stable operationIds, failure-injection tests green |
| 8.1-8.6 Database integrity | PASS | CHECK constraints, `PRAGMA user_version` newer-schema rejection, semantic version storage, storage-unavailable UI, migration/rollback tests green |
| 9.1-9.7 Rating/progress correctness | PASS | applied delta persisted, freshness via event time, Home streak via distinct dates, Results via exact history, composite via `composite-explainer`, recent games real |
| 10.1-10.6 Game-platform convergence | PASS | lazy cache outside render, shared `game-ui` primitives across all 24 games (GameButton, PauseOverlay, TutorialFrame, QaPanelShell, etc.), sensory seam classified DEFERRED then re-implemented via real engine in 007 convergence, error boundary `resetKey`, Memory variant audit |
| 11.1-11.6 Governance + CI gates | PASS | task ownership validator, CI includes lint/repo-state/registry/provenance/ownership/typecheck/test/web export/doctor, cross-subsystem suite, dependency audit triaged |
| 12.1 Registry exactly 20 (at 006R exit) | PASS | 20 games at 006R exit (before Wave 01 expansion); validated via `--check` |
| 12.2-12.3,12.5-12.6,12.8,12.10 Non-emulator gates | PASS | provenance, generator sweeps, tutorial persistence, economy fault injection, DB newer-schema, repo/ownership/lint/typecheck/Jest/registry/web/doctor all green |
| 12.4,12.7,12.9 AVD smoke | NOT VALIDATED | Same AVD-block as 3.6/6.8; per-game screen tests cover flows in Jest; canaries for existing categories verified via earlier `CRBABot_API_36` dumps |
| 12.11 CI green | NOT VALIDATED | CI auto-runs on push to `main`; result only observable via GitHub Actions UI |
| 12.12 No Critical/High | PASS | No unresolved Critical/High; Medium/Low debt recorded |
| 12.13 Durable state | PASS | STATE/VALIDATION/KNOWN_ISSUES reconciled at checkpoint |

## Honest NOT VALIDATED summary (not product defects)

- **AVD/emulator gates (3.6, 6.8, 12.4, 12.7, 12.9):** Require a live AVD + Metro + debug APK with `adb` hierarchy taps. Host previously demonstrated `CRBABot_API_36` (API 36, x86_64, `-no-window`, `adb reverse`, deep-link `braintraining://game/memory` + `speed-tap-rush` testIDs, screenshots in `qa-artifacts/`). Full 4/4 workout + per-game pause/force-finish/persist journeys not driven in this wave; harness `scripts/qa/autobot.mjs` is merged and ready for next on-device pass. Recorded as NOT VALIDATED, never faked green.
- **12.11 GitHub CI:** Auto-runs on push; must be confirmed from GitHub UI after final promotion.
- **Host NDK pin:** `27.0.12077973` in `android/gradle.properties` (generated, `.gitignored`), plus SDK `c++_shared` patch — reversible per-host, documented, `BUILD SUCCESSFUL`.

## Convergence note

006R's breadth freeze (no new games until validated) is now lifted: the subsequent **Campaign 007 — Parallel Wave 01 Convergence** (owner-authorized) integrates the 4 new games (Target Count, Rule Grid, Cue Shift, Grid Navigator → 24 total) plus Progress, Engagement, Data Portability, Sensory (real engine), Accessibility, and QA harness, building on the 006R-corrected contracts. The 24-game catalog was validated on the integration branch (239 suites / 2727 tests green, tsc clean, lint 0 errors, registry up-to-date) before promotion.

## Validation at checkpoint

- `node scripts/validate-repo-state.mjs`: PASS
- `npx --no-install openspec validate 006r-core-integrity-correction`: PASS
- `node scripts/generate-game-registry.mjs --check`: PASS (20 at this checkpoint; 24 after Wave 01 convergence)
- `node scripts/validate-provenance.mjs --check`: PASS
- `node scripts/validate-task-ownership.cjs`: PASS
- `node scripts/validate-offline.mjs --check`: PASS (CLEAN)
- `npx tsc --noEmit`: PASS (0 errors)
- `npx jest --ci --maxWorkers=2`: PASS (239 suites / 2727 tests, 4 snapshots)
- `npx expo export --platform web`: PASS (15 routes at 006R; 19+ after convergence)
- `npx expo-doctor`: PASS (21/21)
- `npm run lint`: PASS (0 errors, 262 warnings)
