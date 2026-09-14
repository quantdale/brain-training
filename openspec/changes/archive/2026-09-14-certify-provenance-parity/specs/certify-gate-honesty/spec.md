## ADDED Requirements

### Requirement: Clean-checkout provenance is not a tautological diff
`scripts/certification/certify-clean-checkout.mjs` MUST invoke provenance with a base that is not `origin/main` when that ref equals HEAD (the 028/CI failure class). It MUST use the same class of resolution as App CI (`HEAD^` / explicit env) or fail closed.

#### Scenario: Main checkout still diffs something
- GIVEN a clean checkout of `main` whose `origin/main` is HEAD
- WHEN certify runs the provenance gate
- THEN it does not report success solely because `changed.files.length === 0` against `origin/main`

#### Scenario: Synthetic generator edit is detected
- GIVEN a temporary edit to a registered `generator.ts` versus the chosen base
- WHEN the certify provenance invocation runs
- THEN it fails closed naming generator-version drift

### Requirement: Skip allowlist entries must match a live skip
`validate-jest-signal` MUST fail when an allowlist entry's file exists and contains `enableWith` but the Jest summary has no pending test attributed to that entry.

#### Scenario: Orphan allowlist row
- GIVEN an allowlist entry whose enable token is present only in a comment and Jest reports no matching skip
- WHEN the signal validator runs against that summary
- THEN it fails naming the stale entry

### Requirement: Remaining certify vs CI gaps are documented
Intentional differences (`npm ci --ignore-scripts`, no native assemble) MUST be listed in the certification README so a green certify cannot be read as a full CI replica.

#### Scenario: Reader sees the exceptions
- GIVEN the certification README
- WHEN a reader looks for gate parity
- THEN provenance base alignment is described as required, and ignore-scripts / no-assemble are explicit exceptions
