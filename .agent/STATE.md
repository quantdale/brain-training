# Durable Project State

**State schema:** 1  
**Last update:** 2026-08-17 (006R baseline restored + rating pipeline canonical difficulty fix committed)  
**Canonical branch:** `main`  
**Active campaign:** `006r-core-integrity-correction`

## Current status

Campaign 005 completed the 20-game catalog foundation. Campaign 006 began platform polish/content work, but a deep audit of commit `2871e5ab0137b1c6475d21100344280ea9927419` found cross-subsystem integrity defects and current App CI/typecheck failure. Campaign 006 is suspended while Campaign 006R corrects the contracts before any further breadth.

### 006R Progress (commits `1d83efb` through `4149e32`)

- **Task 0 (Restore baseline)**: COMPLETED. Tutorial TypeScript errors repaired,
  inherited failures documented (3 pre-existing test failures).
- **Task 1 (Progression/rating authoritative outcome)**: COMPLETED.
  * 1.1: Lowercase difficulty keys ✅
  * 1.2: expectedPerformanceFromChallenge ✅
  * 1.3: Persisted challengeRating ✅
  * 1.4: CompletionOutcome type ✅
  * 1.5: Authoritative XP display across all 20 games ✅
  * 1.6: Cross-subsystem tests ✅
  * 1.7: Easy farming protection proven ✅
- **Task 2 (Content/generator provenance)**: COMPLETED.
  * 2.1: Game inventory (14 procedural, 5 hybrid, 1 curated) ✅
  * 2.2: Standardized version identifiers with contentVersion ✅
  * 2.3: Persisted sessions record exact provenance ✅
  * 2.4: Bumped SCORING_VERSION to 1.1.0 for rating pipeline fix ✅
  * 2.5: Deterministic replay tests ✅
  * 2.6: Provenance drift validator with allowlist ✅
- **Task 3 (Word Match semantic correction)**: MOSTLY COMPLETE.
  * 3.1: Frozen from workout selection ✅
  * 3.2: Content schema redesigned (exactly 1 synonym per item) ✅
  * 3.3: 120 items regenerated with new semantic rule ✅
  * 3.4: Validator and tests updated ✅
  * 3.5: Content version advanced to 2.0.0 ✅
  * 3.6: Emulator smoke test (requires AVD session)
- **Tasks 4–12**: Not yet started.
- **App CI**: FAIL (3 inherited test failures; will turn green when task 5 fixes tutorial tests).

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

`openspec/changes/006r-core-integrity-correction/tasks.md` → **Task 3.2**:
Redesign content schema so exactly one option satisfies the scored relation.

## Important invariants

- GitHub `main` is canonical.
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
