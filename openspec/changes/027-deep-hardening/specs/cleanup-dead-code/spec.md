# Cleanup and Dead Code — Delta Spec

## ADDED Requirements

### Requirement: R1 Dead exports removed

Exports proven unreferenced across the whole repository (including tests)
MUST be removed, unless explicitly documented as public API with a consumer
contract; removal MUST keep `tsc --noEmit` and the full Jest matrix green.

#### Scenario: Whole-repo scan

- GIVEN a symbol with zero references in source, tests, scripts and docs
- WHEN the cleanup runs
- THEN the symbol and its now-orphaned imports/helpers are deleted and the
  matrix passes.

### Requirement: R2 Unreferenced tooling removed

Scripts and tracked artifacts that nothing invokes MUST be removed after a
whole-repo reference scan; anything kept for external/manual use MUST be
documented.

#### Scenario: Stray script

- GIVEN a script referenced by no workflow, package script, document or test
- WHEN the cleanup runs
- THEN it is deleted (or documented), and the repository-integrity validators
  still pass.

### Requirement: R3 Inert allowlist debt removed

Configuration entries that validation semantics ignore MUST be removed or
regenerated so the file does not imply protections that do not exist.

#### Scenario: Provenance allowlist

- GIVEN entries without a future expiry are treated as absent
- WHEN the allowlist is regenerated
- THEN `validate-provenance.mjs --check` stays clean and no permanent inert
  entry remains.
