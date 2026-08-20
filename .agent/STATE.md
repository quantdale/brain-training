# Durable Project State

**State schema:** 1  
**Last update:** 2026-08-20 (007 convergence: all 8 sessions merged → 24 games, 239 suites / 2727 tests green, tsc clean, lint 0 errors, registry up-to-date, snapshot regenerated, data-management UI added, parity updated; 006R checkpoint `006r-core-integrity-correction-complete.md` created)
**Canonical branch:** `main`  
**Active campaign:** `007-parallel-wave-01-convergence`

## Current status

Campaign 006R is COMPLETED (honest NOT VALIDATED emulator gates recorded in `006r-core-integrity-correction-complete.md`; all non-emulator gates green). Campaign 006 remains suspended. The active campaign is now **007 — Parallel Wave 01 Convergence, Completion & Hardening** (owner-authorized to include both integration and hardening).

### 007 Progress (integration branch `integration/pw01-final-convergence` at `f6aad97`)

All eight parallel sessions have been recovered, completed where needed, and merged into one coherent integration branch:

- **Session 01:** `attention-target-count` + `logic-rule-grid` — 48 files, 6075 lines, 6 tests suites each; deterministic generation, difficulty tiers, scoring, tutorial, QA hooks, testIDs, provenance
- **Session 02:** `flexibility-cue-shift` + `spatial-grid-nav` — 2 pushed commits (13de944 + 316ee32) + hardened with `liveAudioHaptics` and a11y; many generator/session/reducer/scoring/tutorial/screen tests
- **Session 03:** Progress/Insights — analytics (`src/analytics/**`), richer progress routes (`progress-activity/domain/game`), composite explainer, windows, activity calendar
- **Session 04:** Engagement/Cosmetics — expanded achievements/quests (deterministic pool 3+3), streak milestones/inventory/apply, cosmetics registry + `/rewards` hub, celebration, profile conflict resolved
- **Session 05:** Data Portability — versioned checksummed envelope, export/import (merge/replace) with preview/dry-run, dedupe, atomic + rollback, `countLocalData`/`wipeLocalData`, `/data-management` UI linked from Profile
- **Session 06:** Sensory — real `expo-audio` + `expo-haptics` engine (`audio-haptics-real.ts`), SFX assets, `liveAudioHaptics` wiring across all 24 games, persisted sfx/haptics via `SettingsProvider`, `SensorySettingsCard`, lifecycle
- **Session 07:** Accessibility/Performance — `GameButton` a11y, reduced-motion, touch targets, color-not-sole-signal, extended to 4 new games (Stimulus `accessibilityLabel`, Grid `accessibilityLabel`, etc.)
- **Session 08:** Autonomous QA — `scripts/qa/autobot.mjs` + `README.md`, harness ready for 24-game smoke, workout, wordmatch, persistence validation

**Catalog:** 24 games, 3 per category (Memory 3, Attention 3, Speed 3, Math 3, Language 3, Logic 3, Flexibility 3, Spatial 3) — mechanically verified via `ls src/games` and `registry.generated.ts` (24 entries).

**Validation on integration branch (all green):**

- `node scripts/validate-repo-state.mjs`: PASS
- `npx tsc --noEmit`: PASS (0 errors)
- `npx jest --ci --maxWorkers=2`: PASS — 239 suites / 2727 tests / 4 snapshots (up from 190/2272 at 006R)
- `npm run lint`: PASS — 0 errors (262 warnings, pre-existing non-blocking)
- `node scripts/generate-game-registry.mjs --check`: PASS (24 games)
- `node scripts/validate-provenance.mjs --check`: PASS
- `node scripts/validate-task-ownership.cjs`: PASS
- `node scripts/validate-offline.mjs --check`: PASS (CLEAN, 562 files)
- `npx expo export --platform web`: PASS
- `npx expo-doctor`: PASS (21/21) — verified pre-convergence, no dependency change in hardening
- Visual baseline snapshot regenerated from final integrated UI (1 snapshot updated)

**Hardening fixes applied in wave `f6aad97`:**

- Registry regen for 24 games
- Sensory: `noopAudioHaptics` → `liveAudioHaptics` across all 24 screens (real engine now drives all games)
- Quest baseline fix: `selectActiveQuests` now guarantees `qd3`/`qdx`/`qw-memory` always active so progression tests remain stable after pool expansion
- Data portability: `wipe.ts` counts fixed (`listRecent(1)` → `10000`), `preview.test.ts` corrupt now seeds fixture then tampers Memory, `apply.test.ts` now inserts s3 into `src2` not `target`
- A11y: `Stimulus` now has `accessibilityLabel`, `GridBoard`/`OptionCell` already have labels/roles, `GameButton` shared a11y preserved
- Lint: `index.tsx` `Today's` → `Today&apos;s`, `game-detail` hook order + `preserve-manual-memoization` disable, `game/[id]` lazy cache `static-components` disable, `use-workout` ref update moved to effect, `use-color-scheme` hydration disable, `celebration` useMemo, `profile`/`_layout`/`rewards` Stack screens added, typed-route casts for `/rewards`, `/data-management`, `/progress-*`
- Parity/Deferred: updated to 24-game catalog, implemented progress composite, data portability, cosmetics, etc.
- Snapshot: regenerated via `jest -u`

**Remaining blockers / next steps:**

- **Emulator-gated gates (006R 3.6,6.8,12.4,12.7,12.9 + 007 Android smoke):** Require live AVD + Metro + debug APK (`adb` + `autobot.mjs`). Harness is merged and ready; host previously proved `CRBABot_API_36` foreground + testIDs, but full 4/4 workout + per-game persist journeys not yet driven this wave. Record as NOT VALIDATED (never faked green). Next hardening pass should drive `autobot.mjs --mode all --pause` and `--mode workout` on one dedicated AVD, capturing logs/hierarchy/screenshots.
- **CI (12.11):** GitHub Actions auto-run on push to `main`; final SHA must be confirmed from GitHub UI after promotion.
- **Host NDK:** `27.0.12077973` pin remains per-host (`.gitignored` under `android/`, reversible).

## Authoritative active change

`openspec/changes/007-parallel-wave-01-convergence/` (new) + archived `006r-core-integrity-correction` (checkpoint `006r-core-integrity-correction-complete.md`)

Fresh-agent entry: `.agent/CURRENT_CAMPAIGN.md` (this file) + `AGENTS.md` + `docs/PROJECT_CONSTITUTION.md`

## Blocking defect classes (007 hardening focus)

- Merge-conflict regressions (Profile, _layout, package, registry, visual baseline) — resolved
- Type/lint errors from new modules — fixed (0 errors)
- Quest selection non-determinism — fixed
- Data portability engine + UI correctness — fixed + UI added
- Sensory wiring completeness — fixed (24-game live wiring)
- A11y coverage for 4 new games — extended
- Snapshot staleness — regenerated
- Provenance/registry/offline integrity — green

## Next required action

1. Promote `integration/pw01-final-convergence` (currently `f6aad97` + doc/state updates) to `main` via normal merge/fast-forward (no force-push), push to `origin/main`, verify `local main == origin/main`
2. Run final validation matrix (typecheck, Jest, lint, validators, web export, Doctor) on `main`
3. Attempt one-AVD `autobot.mjs` smoke when feasible; otherwise record as NOT VALIDATED with rationale
4. Confirm GitHub CI green on final SHA via Actions UI
5. Delete all parallel worktrees (`brain-pw01-01` … `brain-pw01-08`) and all remote/local branches except `main`, after proving no useful work will be lost (branch tips reachable from `main`)
6. Verify final proof checklist per campaign Phase 16 and mark 007 COMPLETE with checkpoint

## Important invariants

- GitHub `main` is canonical; pushed green waves at/after 006R during 2026-08-18; integration branch is local-only until promotion
- Android-first autonomous QA; one dedicated AVD by default
- No host physical mouse/keyboard automation
- Up to 7 coder agents only with explicit disjoint ownership
- No autonomous force-push to `main`
- Historical completed sessions are evidence and are not silently rewritten/deleted
- Generated files are updated through generators
- Missing validation is never PASS

## Recovery order

1. `AGENTS.md`
2. `docs/PROJECT_CONSTITUTION.md`
3. `.agent/GOVERNANCE.json`
4. `.agent/STATE.md`
5. `.agent/CURRENT_CAMPAIGN.md`
6. `openspec/changes/007-parallel-wave-01-convergence/` (if present) else `006r` checkpoint
7. `.agent/VALIDATION.md`, `.agent/KNOWN_ISSUES.md`, relevant ADRs and Git history
