# Tooling and CI — Delta Spec

## ADDED Requirements

### Requirement: R1 Workflow validator covers supply-chain and masking rules

`scripts/validate-workflows.mjs` MUST reject unpinned `uses:` references
(unless explicitly allowlisted with rationale) and MUST reject
`continue-on-error: true` that is not paired with an enforcing step in the
same job; its self-test MUST prove detection and non-detection.

#### Scenario: Unpinned action

- GIVEN a workflow using `actions/checkout@v7`
- WHEN the validator runs
- THEN it fails with the offending file and line, and a SHA-pinned reference
  passes.

### Requirement: R2 Dependency audit gate

CI MUST run a dependency-audit check that fails on production-reachable
moderate-or-higher advisories, classifies accepted build/dev advisories in an
explicit allowlist, self-tests its classifier, and records BLOCKED (never a
silent pass) when the audit cannot run.

#### Scenario: Production advisory

- GIVEN an advisory affecting a runtime dependency
- WHEN the gate runs
- THEN it fails; a dev-toolchain advisory on the allowlist passes with a
  recorded classification.

### Requirement: R3 Actions pinned

Workflow actions MUST be pinned to immutable commit SHAs (tag kept in a
comment); if a SHA cannot be resolved, the deferral MUST be recorded with the
blocker instead of silently leaving a mutable tag.

#### Scenario: Pin audit

- GIVEN the workflow files
- WHEN the validator runs
- THEN every `uses:` is a full SHA or an allowlisted, documented exception.
