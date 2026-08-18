# Durable Project State

**State schema:** 1  
**Last update:** 2026-08-18 (006R core-integrity tasks 1-9, 11, 12.1/12.2/12.3/12.5/12.6/12.8/12.10 and 10.4/10.5/10.6 complete; emulator-gated gates NOT VALIDATED; 10.2/10.3 tracked remaining)  
**Canonical branch:** `main`  
**Active campaign:** `006r-core-integrity-correction`

## Current status

Campaign 005 completed the 20-game catalog foundation. Campaign 006 began platform polish/content work, but a deep audit of commit `2871e5ab0137b1c6475d21100344280ea9927419` found cross-subsystem integrity defects and current App CI/typecheck failure. Campaign 006 is suspended while Campaign 006R corrects the contracts before any further breadth.

### 006R Progress (green waves committed/pushed on `main`)

All of tasks 0-9, 11, 10.1/10.4/10.5/10.6, and exit-gate 12.1/12.2/12.3/12.5/12.6/12.8/12.10 are **complete and verified green locally** (full Jest suite 190 suites / 2272 tests, tsc clean, lint, OpenSpec valid, registry/provenance/repo-state/ownership validators all PASS, web export + Expo Doctor 21/21). The three inherited test failures reported earlier were diagnosed as stale tests (a registry item-count pin and two tutorial tests that did not drive the current 3-step tutorial) and repaired, so the suite is now fully green.

**IMPORTANT blockers / remaining work:**
- **Emulator-gated gates cannot be validated on this host** (no AVD/emulator): tasks 3.6 (Word Match emulator smoke), 6.8 (Daily Workout AVD journey), 12.4, 12.7, 12.9 (One-AVD smoke). These are `NOT VALIDATED` (an external condition), never faked green.
- **12.11 (GitHub App CI + Repository Integrity green on final SHA):** CI auto-runs on push to `main`; result is not locally observable and must be confirmed from the GitHub Actions UI.
- **10.2/10.3 (shared generic game UI primitives + canary migration):** still open. Games keep per-module UI copies; a shared-primitive draft was created and reverted because nothing was wired to it. Tracked in `.agent/KNOWN_ISSUES.md` for a focused future wave.

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

Tasks 0, 1, and 2 are completed. Task 3 (Word Match semantic correction) is in
progress with 3.1 done. The next unchecked task is:

`openspec/changes/006r-core-integrity-correction/tasks.md` → outstanding items are the
emulator-gated `NOT VALIDATED` gates (3.6, 6.8, 12.4, 12.7, 12.9), 12.11 (CI
result confirmation), and the tracked 10.2/10.3 shared-primitive wave. All
other tasks are green locally.

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
