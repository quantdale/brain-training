# Durable Project State

**State schema:** 1  
**Last update:** 2026-08-17 (Campaign 006R converted to repository-resident OpenSpec execution)  
**Canonical branch:** `main`  
**Active campaign:** `006r-core-integrity-correction`

## Current status

Campaign 005 completed the 20-game catalog foundation. Campaign 006 began platform polish/content work, but a deep audit of commit `2871e5ab0137b1c6475d21100344280ea9927419` found cross-subsystem integrity defects and current App CI/typecheck failure. Campaign 006 is suspended while Campaign 006R corrects the contracts before any further breadth.

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

Execute the first unchecked task in:

`openspec/changes/006r-core-integrity-correction/tasks.md`

The first wave restores local/CI green before semantic fixes. Do not skip forward to catalog exit validation.

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
