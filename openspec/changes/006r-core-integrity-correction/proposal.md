# Proposal — Campaign 006R Core Integrity Correction

**Change:** `006r-core-integrity-correction`  
**Status:** ACTIVE  
**Baseline audited commit:** `2871e5ab0137b1c6475d21100344280ea9927419`

## Summary

Pause catalog/content breadth and repair the semantic contracts that the existing 20-game platform depends on. The autonomous foundation and modular architecture are retained; this change corrects cross-subsystem integrity defects that ordinary unit-test volume did not catch.

## Why now

The repository can autonomously produce and test code at high speed, but the deep audit found several cases where structurally valid code produces semantically wrong product behavior. Examples include difficulty values falling through the shared rating map, game result UI showing `0 XP` while SQLite awards real XP, ambiguous Word Match questions, Equation Builder puzzles that can be unsolvable under the selected operator set, transient tutorial completion, Daily Workout being a recommendation list rather than a persisted workout flow, and non-atomic economy operations.

If breadth continues before these contracts are corrected, the defects will be multiplied across dozens of games and become much more expensive to repair.

## Goals

This change MUST:

1. Restore a green build/typecheck/test baseline before further implementation.
2. Make rating/XP behavior use canonical lowercase difficulty and actual challenge evidence.
3. Make the authoritative persisted progression outcome the same outcome shown to the player.
4. Preserve/reconcile historical derived ratings without deleting or silently rewriting session evidence.
5. Enforce generator/content provenance so historical seeds remain meaningful after updates.
6. Redesign Word Match so every scored question has one defensible answer.
7. Guarantee Equation Builder solvability for every active difficulty and every returned path.
8. Persist tutorial completion/replay across process restarts with tutorial versioning.
9. Implement Today's Workout as a durable four-game workflow with resume, completion, and transactional rerolls.
10. Make purchases, spends, and reward claims atomic and idempotent.
11. Tighten SQLite constraints and reject unsupported newer schemas.
12. Correct player-visible streak/rating/history/composite analytics.
13. Converge shared game-platform seams where current duplication causes correctness or maintenance risk.
14. Add machine-enforced swarm ownership and semantic CI gates.
15. Prove the repaired contracts against the entire 20-game catalog and one Android AVD before resuming Campaign 006.

## Non-goals

This change MUST NOT expand the game catalog, add content merely to increase counts, implement cloud sync/auth/AI/monetization/ads, perform unrelated visual redesign, or initiate general production hardening beyond the integrity checks required by this change.

## Scope freeze

Until this change is VALIDATED:

- no new game module may be added;
- raw content-count expansion is prohibited;
- Campaign 006 polish work may continue only when it directly supports a 006R requirement and does not obscure the integrity work;
- historical completed sessions are evidence and MUST NOT be silently deleted or rewritten.

## Success definition

The change is successful only when all normative specs under `specs/` pass, the task checklist is complete, the final 20-game convergence gate passes, the dedicated Android runtime journeys pass or are explicitly BLOCKED with evidence, no Critical/High defect remains, and the final pushed `main` SHA is green in repository integrity and App CI.