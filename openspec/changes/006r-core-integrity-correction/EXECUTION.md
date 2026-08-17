# Execution Entry — 006R

This is the short-entry file for autonomous agents.

## Recovery

1. Ensure the local checkout is on canonical `main` and synchronized with `origin/main` without discarding uncommitted user work.
2. Read `AGENTS.md`, `docs/PROJECT_CONSTITUTION.md`, `.agent/GOVERNANCE.json`, `.agent/STATE.md`, `.agent/CURRENT_CAMPAIGN.md`.
3. Read this change's `proposal.md`, `design.md`, all normative `specs/**/spec.md`, then `tasks.md`.
4. Treat `.agent/specs/006r-core-integrity-correction/**` as audit/supporting material only if clarification is needed; OpenSpec is authoritative for execution.

## Execute

- Work the unchecked tasks in `tasks.md` in dependency order.
- Restore a green baseline before feature-level repair.
- Use swarm only for disjoint write surfaces; orchestrator owns shared schema/navigation/registry-generator/Game-SDK/CI/durable-state convergence.
- `language-word-match` and `math-equation-builder` may run in parallel after the provenance contract is established.
- Do not add games or expand content counts for breadth.
- After each coherent wave: run required validation, repair Critical/High regressions, update task checkboxes and `.agent/VALIDATION.md`, commit, and push `main`.
- Do not claim a requirement complete without its scenarios/evidence.

## Stop conditions

Stop only when either:

- every task and normative requirement is validated and the full-catalog exit gate passes; or
- a genuine external blocker is durably recorded, safe work is committed/pushed, and the repository is left as healthy as practical.

On success, create `.agent/checkpoints/006r-core-integrity-correction-complete.md`, archive this change per project convention, and rescope Campaign 006 rather than blindly resuming old content-expansion packets.