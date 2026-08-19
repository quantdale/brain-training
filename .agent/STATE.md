# Durable Project State

**State schema:** 1  
**Last update:** 2026-08-20 (006R core-integrity tasks 1-9, 10.1-10.6, 11, 12.1/12.2/12.3/12.5/12.6/12.8/12.10 complete; 10.2/10.3 shared game-ui migrated to ALL 20 games; final `src/games` lint cleanup → 0 errors; emulator-gated gates NOT VALIDATED)  
**Canonical branch:** `main`  
**Active campaign:** `006r-core-integrity-correction`

## Current status

Campaign 005 completed the 20-game catalog foundation. Campaign 006 began platform polish/content work, but a deep audit of commit `2871e5ab0137b1c6475d21100344280ea9927419` found cross-subsystem integrity defects and current App CI/typecheck failure. Campaign 006 is suspended while Campaign 006R corrects the contracts before any further breadth.

### 006R Progress (green waves committed/pushed on `main`)

All of tasks 0-9, 10.1-10.6, 11, and exit-gate 12.1/12.2/12.3/12.5/12.6/12.8/12.10 are **complete and verified green locally** (full Jest suite 190 suites / 2272 tests, tsc clean, lint, OpenSpec valid, registry/provenance/repo-state/ownership validators all PASS, web export + Expo Doctor 21/21). The three inherited test failures reported earlier were diagnosed as stale tests (a registry item-count pin and two tutorial tests that did not drive the current 3-step tutorial) and repaired, so the suite is now fully green. Task 10.2/10.3 shared game-ui primitives are migrated across ALL 20 games: per-game `button.tsx` is a `GameButton` re-export adapter; `pause-overlay.tsx`/`qa-panel.tsx` are thin `PauseOverlay`/`QaPanelShell` adapters (injecting `GAME_ID`); `tutorial.tsx` wraps content in `TutorialFrame`; `screen.tsx` uses shared `DifficultySelector`/`SessionHeader`/`StatRow`. Three migration batches committed (6 canaries; 3 language games; final 7 games). `QaPanelShell.extraActions` keeps per-game QA local. A final cleanup wave (`6f75d09`) resolved the last 8 `eslint` errors across `src/games` (5 tutorial JSX entity escapes + a behavior-preserving `memory-sequence-memory` render-time ref read → state-driven countdown label), bringing `eslint src/games` to **0 errors** (187 pre-existing non-blocking warnings remain).

**IMPORTANT blockers / remaining work:**
- **Emulator-gated gates cannot be validated on this host** (no AVD/emulator): tasks 3.6 (Word Match emulator smoke), 6.8 (Daily Workout AVD journey), 12.4, 12.7, 12.9 (One-AVD smoke). These are `NOT VALIDATED` (an external condition), never faked green.
- **12.11 (GitHub App CI + Repository Integrity green on final SHA):** CI auto-runs on push to `main`; result is not locally observable and must be confirmed from the GitHub Actions UI.

Because the emulator-gated validation cannot run in this environment, the change is **NOT fully VALIDATED** and no completion checkpoint is claimed.

## Authoritative active change

`openspec/changes/006r-core-integrity-correction/`

Fresh-agent entry:

`openspec/changes/006r-core-integrity-correction/EXECUTION.md`

The change contains proposal, design, machine-readable metadata, audit map, normative capability specs, and the durable task checklist. The earlier `.agent/specs/006r-core-integrity-correction/` material remains supporting audit documentation only.

## Blocking defect classes being corrected

- canonical difficulty/rating policy mismatch and ignored fine-grained challenge;
- UI/persistence progression outcome divergence;
- historical derived-rating audit/correction;
- content/generator provenance drift;
- ambiguous Word Match scoring;
- Equation Builder all-difficulty solvability;
- transient tutorial completion;
- non-durable/non-sequential Today's Workout and reorder-only personalization;
- non-atomic/idempotent economy operations;
- DB constraints/version compatibility/provenance storage;
- rating/streak/results/composite correctness;
- shared game-platform drift/lazy identity/sensory seams;
- unsafe swarm ownership and insufficient semantic CI gates.

## Next required action

Tasks 0-11 are complete, including 10.2/10.3 game-ui migration now covering all 20
games. Remaining unchecked items in `openspec/changes/006r-core-integrity-correction/tasks.md`
are the emulator-gated `NOT VALIDATED` gates (3.6, 6.8, 12.4, 12.7, 12.9) and 12.11
(CI result confirmation). All other tasks are green locally (full Jest 2272 tests, tsc
clean, lint clean across all games, repo-state/ownership/provenance validators PASS);
no further code work is required on this host until an AVD/CI environment is available.

## Important invariants

- GitHub `main` is canonical; pushed green waves at/after 006R during 2026-08-18.
- Android-first autonomous QA; one dedicated AVD by default.
- No host physical mouse/keyboard automation.
- Up to 7 coder agents only with explicit disjoint ownership.
- No autonomous force-push to `main`.
- No new games/content-count breadth until 006R validates.
- Historical completed sessions are evidence and are not silently rewritten/deleted.
- Generated files are updated through generators.
- Missing validation is never PASS.

## Recovery order

1. `AGENTS.md`
2. `docs/PROJECT_CONSTITUTION.md`
3. `.agent/GOVERNANCE.json`
4. `.agent/STATE.md`
5. `.agent/CURRENT_CAMPAIGN.md`
6. `openspec/changes/006r-core-integrity-correction/EXECUTION.md`
7. `proposal.md`, `design.md`, `specs/**/spec.md`, `tasks.md`
8. `.agent/VALIDATION.md`, `.agent/KNOWN_ISSUES.md`, relevant ADRs and Git history
