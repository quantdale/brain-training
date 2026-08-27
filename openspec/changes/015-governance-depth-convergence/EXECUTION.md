# Execution Entry — Campaign 015 Governance & Depth Convergence

This is the short autonomous execution entrypoint.

**Current lifecycle state:** PROPOSED.  
**Do not activate until Campaign 014 is durably COMPLETED.**

## 12-hour execution envelope

This handoff is sized for one autonomous ~12-hour run. Continue through dependency-ready work for the full useful session; do not stop after one successful wave. Do not idle merely to reach a clock. If all in-scope implementation finishes early, spend remaining useful time on deterministic/adversarial validation, warning/flake cleanup tied to changed surfaces, state/docs reconciliation, and exact-SHA CI confirmation. Never use the time budget as permission to start an unrelated hardening or breadth campaign.

Before any termination, write/push a durable checkpoint with start/end SHA, commits, completed/remaining tasks, exact validation results, CI run IDs, device evidence/blockers, and next action.

## Recovery

1. Synchronize canonical `main` without discarding unrelated user work.
2. Read `AGENTS.md` and `docs/PROJECT_CONSTITUTION.md`.
3. Read `.agent/GOVERNANCE.json`, `.agent/STATE.md`,
   `.agent/CURRENT_CAMPAIGN.md`, `.agent/KNOWN_ISSUES.md`,
   `.agent/VALIDATION.md`, and `.agent/CAMPAIGN015_AUDIT.md`.
4. Read this change's `proposal.md`, `design.md`, all normative
   `specs/**/spec.md`, then `tasks.md`.
5. Run:
   - `node scripts/validate-repo-state.mjs`
   - `node scripts/validate-task-ownership.cjs`
   - `npx --yes @fission-ai/openspec@1.6.0 validate --all`
6. Inspect git status/history/remote and reconcile documentation with code
   before editing.

## Phase -1 — current-head red-main recovery

At the audited baseline `366a098`, App CI run `33051125658` failed Jest (2 suites / 2 tests) while Repository Integrity passed. The failures are the 10-second workout timestamp-grace regression in `findActiveInstanceForGame` and `shouldAdvanceWorkout`.

Before any other phase:

- reproduce current failures on the pulled SHA;
- preserve stale/equal-session rejection;
- establish causal workout/session ownership instead of a positive fixed-duration grace heuristic;
- run the adversarial attribution matrix from the `workout-integrity` spec;
- restore full local green and push;
- require App CI + Repository Integrity green on the exact repair SHA;
- synchronize durable state so committed/pushed work is not described as unpushed.

If HEAD has moved, re-audit the relevant diff/CI first. Current code and CI outrank this recorded baseline.

## Phase 0 — predecessor closure gate

If Campaign 014 is ACTIVE, **do not begin Campaign 015 implementation**.

Finish only Campaign 014's recorded exit work:

- restore/use the dedicated `braintraining-qa36` AVD; never adopt a foreign
  co-tenant emulator;
- run the required Workout V3 E2E + representative changed-game canary journeys
  recorded in Campaign 014 validation instructions;
- run the missing docs-final reconciliation, including current Workout V3
  terminology and campaign/state pointers;
- resolve the contradictory Campaign 013 text still present in STATE;
- record any missing game-feel/perf evidence exactly as PASS/FAIL/NOT VALIDATED
  according to Campaign 014's exit contract;
- write the Campaign 014 terminal checkpoint;
- update 014 durable status consistently, validate, commit, and push.

If a required Campaign 014 gate remains externally unavailable, leave Campaign
015 PROPOSED, record the blocker, and stop. Do not bypass the predecessor.

## Phase 1 — atomic activation

Only after Campaign 014 is COMPLETED:

1. change this `change.json` status from PROPOSED to ACTIVE;
2. set `.agent/GOVERNANCE.json.activeCampaign` to
   `015-governance-depth-convergence`;
3. replace `.agent/CURRENT_CAMPAIGN.md` / `.agent/EXECUTION_PROMPT.md` with
   Campaign 015 execution pointers;
4. synchronize `.agent/STATE.md`;
5. replace `.agent/task-ownership.json` with the Campaign 015 packet map;
6. run repository state, OpenSpec, and ownership validation;
7. commit/push the transition before feature packets.

There must be exactly one ACTIVE campaign.

## Phase 2 — execute unchecked OpenSpec tasks

Work `tasks.md` in dependency order.

Recommended parallelization after governance bootstrap:

- packet A: Rule Grid chained-deduction implementation;
- packet B: Word Chain curated expansion;
- packet C: Context Fit curated expansion;
- packet D: Transform Match invariant/ambiguity repair;

provided their write surfaces are disjoint and the active ownership map proves
that fact.

The orchestrator owns:

- governance/state/OpenSpec files;
- task-ownership convergence;
- CI and validator shared surfaces;
- generated registry/provenance outputs;
- package manifests/lockfiles;
- final version convergence;
- integration/Android QA.

Do not let parallel coders edit generated outputs or shared state files.

## Per-wave discipline

For every coherent wave:

1. determine affected areas using `scripts/validate-affected.mjs`;
2. run the required cheap checks plus packet-specific tests;
3. fix any new Critical/High regression before expanding scope;
4. update task evidence and `.agent/VALIDATION.md`;
5. update durable state at meaningful recovery boundaries;
6. commit and push coherent progress.

Use deterministic seeds and version challenge semantics when behavior changes.

## Final gate

Before declaring IMPLEMENTED/VALIDATED:

- repository/OpenSpec/ownership/affected-area integrity green;
- registry generation + provenance drift check green;
- offline boundary green;
- QA harness self-test green;
- TypeScript green;
- lint 0/0;
- full Jest green;
- web export green;
- Expo Doctor green;
- targeted many-seed game/content validators green;
- fresh performance probe evidence recorded for affected hot paths;
- changed-surface accessibility evidence recorded honestly;
- dedicated-project Android canaries green;
- no unresolved Critical/High regression;
- final pushed SHA green in GitHub App CI and Repository Integrity.

Then mark OpenSpec lifecycle state accurately, write the terminal checkpoint,
synchronize durable state, and leave `main` clean.

## Stop conditions

Stop only when:

- the campaign is VALIDATED and all exit requirements are satisfied; or
- a genuine external blocker is durably recorded with safe work pushed and no
  false completion claim.

Do not add game #43. Do not silently broaden into hardening.
