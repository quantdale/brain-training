# Spec — adversarial-convergence-static-governance

## ADDED Requirements

### Requirement: Static architecture and contract integrity

The change SHALL run independent static/architecture/contract critic
passes and repair or record every verified finding: import cycles,
dead/unused exports that mislead, duplicated canonical logic,
generated-registry drift, contract drift between type declarations and
runtime usage, and stale references in docs/configs.

#### Scenario: Verified static defect is repaired with a gate

- GIVEN a critic finding confirmed against the code
- WHEN it is accepted into this change
- THEN a minimal repair lands with a focused regression test or a
  deterministic validator, and the finding is recorded with its
  disposition.

#### Scenario: Unverified claim is rejected

- GIVEN a critic claim that cannot be reproduced
- WHEN the disposition is recorded
- THEN it is marked NOT REPRODUCED with the evidence, not silently fixed.

### Requirement: Governance and OpenSpec reconciliation

`GOVERNANCE.json`, `STATE.md`, `CURRENT_CAMPAIGN.md`,
`task-ownership.json`, `.agent/OVERNIGHT_056_067_STATE.md`, and every
change 056–066 `change.json` SHALL agree on the program cursor, current
change, verdicts, and validation counts; `validate-repo-state.mjs`
SHALL enforce the machine-checkable subset.

#### Scenario: Program cursor is single-sourced

- GIVEN the program is between changes
- WHEN the governance validator runs
- THEN the cursor, ledger field, and current change directory agree or
  the validator fails naming the contradiction.

### Requirement: Flake, allowlist, and debt audit

Every skip/allowlist entry SHALL carry an owner, rationale, and expiry;
every quarantined flake SHALL have documented closure criteria; and the
debt/backlog audit SHALL produce a disposition for each open item
(fix now, seed for hardening, or close).

#### Scenario: No undocumented skip

- GIVEN the full matrix run
- WHEN the signal validator runs
- THEN every skipped test maps to a reviewed entry with an unexpired
  waiver.

#### Scenario: Debt has dispositions

- GIVEN KNOWN_ISSUES/BACKLOG items
- WHEN the audit completes
- THEN each item is classified with an owner and a closure path.

### Requirement: Residual census seeds post-067 hardening

The change SHALL produce a residual census enumerating
evidence-backed Pass A (static/architecture/contracts/security),
Pass B (runtime/lifecycle/persistence/recovery/perf), and Pass C
(release/UX/a11y/hostile-sequences/production-gap) items, each with
evidence and a proposed probe or test.

#### Scenario: Census is actionable

- GIVEN the census document
- WHEN a hardening pass starts
- THEN every item names the surface, the evidence, and the verification
  recipe without requiring re-discovery.

## MODIFIED Requirements

None.

## REMOVED Requirements

None.
