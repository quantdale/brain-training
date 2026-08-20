# Campaign 007 — Parallel Wave 01 Convergence, Completion & Hardening

**Status:** ACTIVE — owner-authorized convergence + hardening (Day mode)
**Campaign id:** `007-parallel-wave-01-convergence`
**OpenSpec change:** `openspec/changes/007-parallel-wave-01-convergence/` (see `openspec/changes/006r-core-integrity-correction/` for predecessor; archived via checkpoint `006r-core-integrity-correction-complete.md`)
**Execution entry:** this file + `docs/PROJECT_CONSTITUTION.md` + `AGENTS.md` + `.agent/STATE.md`
**Parent:** Campaign 006R is COMPLETED (honest NOT VALIDATED emulator gates recorded; checkpoint `006r-core-integrity-correction-complete.md`). Campaign 006 remains suspended.

## Mission

Recover ALL useful work from the eight parallel Wave 01 sessions, finish anything incomplete, integrate into one coherent 24-game product, harden, verify end-to-end, and leave `main` green with no temporary branches/worktrees.

## Source of truth

1. `docs/PROJECT_CONSTITUTION.md` (locked)
2. `AGENTS.md` + `.agent/GOVERNANCE.json`
3. `.agent/STATE.md` / `.agent/VALIDATION.md` / `.agent/KNOWN_ISSUES.md`
4. Git history + actual code (authoritative over chat memory)
5. This campaign file + `openspec/changes/007-parallel-wave-01-convergence/` (when present)

## Scope (owner-authorized to include BOTH completion + hardening)

- **Games:** 20 base + 4 new = 24 total, 3 per category (Memory 3, Attention 3, Speed 3, Math 3, Language 3, Logic 3, Flexibility 3, Spatial 3)
  - Session 01: `attention-target-count` (Attention) + `logic-rule-grid` (Logic)
  - Session 02: `flexibility-cue-shift` (Flexibility) + `spatial-grid-nav` (Spatial) — already pushed, now converged
- **Progress:** analytics expansion (`src/analytics/**`, `progress-activity/domain/game`, composite explainer, windows, activity calendar)
- **Engagement:** expanded achievements/quests (deterministic daily/weekly pool), streak milestones/inventory/apply, cosmetics registry + `/rewards` hub, celebration
- **Data portability:** versioned checksummed envelope, export/import (merge/replace) with preview/dry-run, dedupe/idempotency, atomic + rollback, `countLocalData`, `/data-management` UI, wipe workflow
- **Sensory:** real `expo-audio` + `expo-haptics` engine (`audio-haptics-real.ts`, SFX assets), `liveAudioHaptics` wiring across all 24 games, persisted sfx/haptics, `SensorySettingsCard`, graceful disable, lifecycle
- **Accessibility/performance:** shared `GameButton` a11y, reduced-motion, touch targets, color-not-sole-signal, extended to all 24 games (including 4 new), performance via evidence-driven memoization
- **QA harness:** `scripts/qa/autobot.mjs` + `README.md` (ADB + hierarchy + testIDs, game/catalog/wordmatch/workout modes, structured JSON, artifacts)

## Integration order (on temporary branch `integration/pw01-final-convergence`)

1. Session 08 (QA harness) — merged
2. Session 06 sensory (real engine) — merged
3. Session 07 a11y/perf — merged
4. Session 02 new games — merged
5. Session 01 new games — merged (recovery commit `b2b1e29`)
6. Session 03 progress — merged
7. Session 04 engagement — merged (profile conflict resolved, lint fixes)
8. Session 05 data portability — merged
9. Hardening: registry regen, sensory live wiring for all 24 games, quest baseline fix, data-portability test fixes, a11y for new components, visual baseline regen, parity/docs updates — committed `f6aad97`

## Exit criteria

- [ ] 24-game catalog mechanically verified (`ls src/games` 24, registry 24, categories 3 each)
- [ ] Generated registry current (`generate-game-registry.mjs --check` PASS)
- [ ] All 8 sessions' useful work present/superseded (verified via branch-tip reachability from `main`)
- [ ] Missing sessions completed (01,04,05,06,07 gaps filled; 02,03,08 already pushed)
- [ ] Sensory: real engine + `liveAudioHaptics` across all 24 games + persisted settings + UI + tests
- [ ] Data portability: engine + `/data-management` + counts/preview/merge/replace/wipe all tested
- [ ] Progress: composite, windows, calendar, per-game all backed by real evidence
- [ ] Engagement/cosmetics: catalog, quests, streaks, rewards all atomic/idempotent with celebration
- [ ] Accessibility: 24-game a11y, reduced-motion, no answer leakage, stable testIDs
- [ ] No unresolved Critical/High defects
- [ ] `tsc --noEmit` PASS (0 errors)
- [ ] `jest --ci` PASS (239 suites / 2727 tests, 4 snapshots)
- [ ] `npm run lint` PASS (0 errors, 262 warnings — pre-existing non-blocking)
- [ ] `validate-repo-state.mjs` PASS
- [ ] `validate-provenance.mjs --check` PASS
- [ ] `validate-task-ownership.cjs` PASS
- [ ] `validate-offline.mjs --check` PASS (CLEAN, 562 files)
- [ ] `expo export --platform web` PASS
- [ ] `expo-doctor` PASS (21/21)
- [ ] Android: build/install/launch + workout journey + wordmatch + per-game smoke (via `autobot.mjs` when AVD available; otherwise honestly NOT VALIDATED)
- [ ] GitHub CI green on final SHA (when observable)
- [ ] Durable state (STATE/VALIDATION/KNOWN_ISSUES/BACKLOG/PARITY_MATRIX/DEFERRED) matches reality
- [ ] `main` buildable/startable, working tree clean, `local main == origin/main`
- [ ] No local branches except `main`, no remote branches except `main`, no extra worktrees

## Constraints

- One AVD, no host mouse/keyboard, ADB/emulator-local only
- Up to 7 coder agents with explicit write ownership; orchestrator owns shared hotspots
- No force-push `main`
- Preserve history where practical (former branch tips reachable from final `main`)
- Never fake green; unavailable checks are NOT VALIDATED/BLOCKED

## Immediate action for fresh agents

1. Read `AGENTS.md`, `docs/PROJECT_CONSTITUTION.md`, `.agent/GOVERNANCE.json`, `.agent/STATE.md`, this file
2. Verify `git status` is clean on `main` and `main == origin/main`
3. Run `node scripts/validate-repo-state.mjs`, `npx tsc --noEmit`, `npx jest --ci --maxWorkers=2`
4. If on `integration/pw01-final-convergence`, verify 24-game catalog and that all validators are green, then promote to `main` per Phase 11, then delete branches/worktrees per Phases 12-15
