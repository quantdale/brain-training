# Change 066 — Adversarial Convergence: Static, Architecture, Governance

**Status:** IN_PROGRESS
**Predecessor:** `065-adversarial-convergence-runtime-data-pixel` (VALIDATED)
**Program SHA:** `428d293`
**Theme:** 065–066 adversarial convergence.

## Problem / evidence

065 closed with a green matrix and a bounded device pass. The remaining
program risk is static and structural: architecture/contract drift,
duplicated logic, dead exports, dependency cycles, generated-artifact
drift, and governance/state bookkeeping that no runtime test can see.
The program defines 066 as: static/architecture/contract attack;
governance/OpenSpec/state reconciliation; flake/allowlist/debt audit;
residual census seed.

This draft records the initial scope; the execution session runs the
independent critic lanes first and refines the task list with verified
findings (every accepted finding must be re-verified against the code
before it enters this change).

## Desired invariant / outcome

- Static architecture is coherent: no new cycles, dead exports,
  duplicated canonical logic, or registry/generated artifacts that drift
  from their sources; any found instance is repaired or recorded with a
  reason.
- Governance state and OpenSpec history reconcile exactly across
  `GOVERNANCE.json`, `STATE.md`, `CURRENT_CAMPAIGN.md`,
  `task-ownership.json`, the ledger, and every change 056–066.
- Flake/allowlist/debt audit produces explicit dispositions: no
  undocumented skip, no expired waiver, no unmapped debt item.
- A residual census seeds the post-067 hardening Pass A/B/C with
  evidence-backed items and owners.

## Non-goals

- No product features, redesign, or speculative refactors.
- No reopening of locked 065/064 decisions without a concrete
  contradiction.
- No full-hardening execution (that is the post-067 phase).

## Affected areas

`scripts/**` (static/governance validators), `.agent/**`,
`openspec/**`, `docs/**`, plus product source only where a verified
static defect requires a minimal repair.

## Protected contracts

All 056–065 behaviors, schema v12, scoring/economy, routing,
offline-first, the console baseline, and the 063 certified artifact
identity.

## Implementation plan

1. Reconnaissance: independent read-only static/architecture/contract,
   flake/allowlist/debt, and governance-reconciliation critic lanes.
2. Refine this change's spec/tasks with verified findings; strict-validate.
3. Implement bounded fixes + guards for accepted findings.
4. Seed the residual census for the post-067 hardening phase.
5. Full validation, adversarial closure, durable state, commit/push.

## Test plan

Focused regression tests per fix; the full repository matrix and all
validators at close; OpenSpec `--all --strict`.

## Runtime/native evidence plan

Expected: none (static/governance change). Any runtime-touching repair
re-uses the 065 bounded device recipe and records exactly what it proved.

## Completion criteria

Standard terminal bar; residual census written; 067 preconditions
listed and satisfiable.
