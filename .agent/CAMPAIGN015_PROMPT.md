# Next-Campaign Handoff — Campaign 015: Governance & Depth Convergence

**Change:** `015-governance-depth-convergence`  
**Status:** PROPOSED — DO NOT activate while Campaign 014 is ACTIVE.  
**Planned from:** `c8acadceb46ad6ba3f90b0c4222583a9a2912f49`

This file is intentionally short. OpenSpec is the executable source of truth.

## Agent instruction

Pull canonical `main`, then:

1. Read `AGENTS.md`, `docs/PROJECT_CONSTITUTION.md`,
   `.agent/GOVERNANCE.json`, `.agent/STATE.md`,
   `.agent/CURRENT_CAMPAIGN.md`, `.agent/KNOWN_ISSUES.md`, and
   `.agent/VALIDATION.md`.
2. Read `.agent/CAMPAIGN015_AUDIT.md`.
3. Read
   `openspec/changes/015-governance-depth-convergence/EXECUTION.md`,
   `proposal.md`, `design.md`, every `specs/**/spec.md`, and `tasks.md`.
4. **Do not bypass Campaign 014.** If 014 is still ACTIVE, execute only the
   predecessor-close phase defined in the 015 execution file: restore the
   dedicated project AVD, run the required Workout V3/canary journeys, complete
   the docs-final reconciliation, synchronize durable state, write the terminal
   checkpoint, validate, commit, and push.
5. Only after Campaign 014 is honestly COMPLETED, perform the atomic 014→015
   transition required by OpenSpec. There must never be two active campaigns.
6. Execute Campaign 015 tasks in dependency order. Use up to the repository's
   normal coder concurrency only for disjoint write surfaces. The orchestrator
   owns governance/state/OpenSpec/schema/shared-registry/CI convergence.
7. After each coherent wave, run the risk-based checks owed by the changed
   surfaces, fix Critical/High regressions immediately, update OpenSpec task
   evidence plus durable state, commit, and push `main`.
8. Never convert an unavailable Android/iOS/manual check into PASS.

## Mission

Make the autonomous campaign system mechanically trustworthy, then close the
small set of verified depth/replayability gaps that remain after Campaign 014:
Rule Grid chained deduction, language content starvation, Transform Match
semantic/invariant safety, and measured runtime/accessibility evidence.

Do not add games or unrelated features.

## Completion

Campaign 015 is complete only when its normative OpenSpec requirements and exit
gate are validated, the final pushed `main` SHA is green in App CI and
Repository Integrity, durable state is mutually consistent, and no unresolved
Critical/High regression remains.
