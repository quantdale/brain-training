# Campaign 006R — Core Integrity Correction

**Status:** ACTIVE — corrective gate staged from deep audit  
**Campaign type:** corrective convergence / integrity repair  
**Campaign id:** `006r-core-integrity-correction`  
**Hardening:** focused integrity validation explicitly authorized by owner; this is not unrelated full-production hardening  
**Parent:** Campaign 006 Platform Hardening and Polish is SUSPENDED until 006R passes  
**Master spec:** `.agent/specs/006r-core-integrity-correction/README.md`

## Why this campaign is active

A deep source-level audit of the current 20-game repository found several cross-subsystem semantic defects that are not adequately represented by the existing test count. The important blockers affect rating difficulty semantics, authoritative XP/result display, content ambiguity/provenance, Equation Builder solvability, tutorial persistence, Today's Workout semantics, and transactional progression/economy.

Campaign 006 breadth/polish work must not continue on top of those defects. New games and content-count expansion are frozen until this corrective gate passes.

## Execution rule

Read the master spec and execute the numbered specs in order:

1. `001-restore-green-main.md`
2. `002-rating-and-authoritative-outcomes.md`
3. `003-content-generator-provenance.md`
4. `004-word-match-semantic-correctness.md`
5. `005-equation-builder-solvability.md`
6. `006-tutorial-persistence.md`
7. `007-daily-workout-and-personalization.md`
8. `008-economy-transactionality.md`
9. `009-database-integrity.md`
10. `010-rating-progress-correctness.md`
11. `011-game-platform-convergence.md`
12. `012-swarm-ci-semantic-gates.md`
13. `013-full-catalog-exit-gate.md`

Do not jump directly to Spec 013. P1 acceptance criteria in earlier specs are blocking.

## First required action

Execute Spec 001 only: restore a verified green local baseline from canonical `main`, repair the current Campaign 006 TypeScript/CI break without type-suppression shortcuts, freeze breadth work, run the required baseline checks, update validation evidence, commit/push the coherent repair, and verify CI when available.

After Spec 001 is green, proceed to Spec 002 unless blocked.

## Swarm policy

- Up to 7 coder agents may be used only after explicit disjoint write ownership is assigned.
- One Android emulator remains the default runtime-QA resource.
- Shared DB schema/migrations, navigation, registry generator, Game SDK/shared platform services, CI, package manifests, and durable state are orchestrator-owned convergence surfaces.
- Specs 004 and 005 may run in parallel after Spec 003's provenance contract is established because they own separate game modules.
- Other parallelization must be justified by non-overlapping ownership.
- Host mouse/keyboard automation remains forbidden.

## Mandatory campaign constraints

- No new game modules.
- No content-count expansion merely for breadth.
- No fake green: unavailable tooling is `NOT VALIDATED`/`BLOCKED`, never PASS.
- No routine force-push to `main`.
- No silent rewrite/delete of historical completed sessions.
- No disabling tests or adding arbitrary retries/sleeps to manufacture green.
- Generated files are updated through generators.
- Each coherent pushed wave should build/typecheck locally before push.

## Exit criteria

Campaign 006R completes only when Spec 013 passes in full, including:

- repaired rating difficulty/adaptive policy;
- authoritative result XP/rating display;
- corrected Word Match semantic uniqueness;
- Equation Builder all-difficulty solvability;
- machine-enforced content/generator provenance/versioning;
- durable tutorial completion/replay;
- persisted four-game Today's Workout + resume + transactional rerolls;
- atomic/idempotent spends/claims/purchases;
- DB integrity/future-version protection;
- correct rating history/evidence time/streak queries;
- stable lazy loading/shared game-platform seams;
- machine-validated swarm ownership + semantic CI contracts;
- full 20-game contract convergence and one-AVD journeys;
- no unresolved Critical/High defect;
- final pushed SHA green in App CI + Repository Integrity when available;
- durable docs/state/checkpoint match reality.

## After completion

Archive `.agent/checkpoints/006r-core-integrity-correction-complete.md`, then rescope and resume Campaign 006 Platform Hardening and Polish. Do not automatically restore its old raw content-expansion packets; they must satisfy the new integrity/provenance contracts first.