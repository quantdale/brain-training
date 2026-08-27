# CI Signal Integrity Requirements

## Requirement CI-1 — Skip classification
Every skipped test/suite in required CI SHALL be explicitly allowlisted with rationale. A new unclassified skip SHALL fail the signal-integrity gate.

## Requirement CI-2 — Console classification
Expected failure-path console output SHALL be asserted and locally suppressed in tests. Unexpected console errors/warnings SHALL remain visible and SHALL fail or be explicitly classified.

## Requirement CI-3 — Toolchain warnings
GitHub Actions and Node runtime warnings SHALL be removed where an available compatible action/tool version exists; unavoidable warnings SHALL be documented.

## Requirement CI-4 — Machine-readable summary
Required test CI SHALL emit a concise machine-readable summary containing passed, failed, skipped and warning counts.

## Requirement CI-5 — Performance separation
Opt-in performance tests SHALL remain distinct from ordinary correctness tests, but SHALL have a documented command/job that actually executes them.
