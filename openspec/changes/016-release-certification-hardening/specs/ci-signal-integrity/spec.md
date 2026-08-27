# CI Signal Integrity — Delta Spec

## ADDED Requirements

### Requirement: Every skipped test is classified

Every skipped test or suite in required CI MUST be explicitly allowlisted with rationale, and new unclassified skips MUST fail the signal-integrity gate.

#### Scenario: New skip appears
- GIVEN the current allowlist describes the known intentional skips
- WHEN Jest reports an additional skipped test or suite
- THEN CI fails the signal-integrity classification step and identifies the new skip.

### Requirement: Expected console output does not hide unexpected errors

Expected failure-path console output MUST be asserted and locally suppressed in tests so unexpected console errors or warnings remain visible.

#### Scenario: Failure-path test intentionally logs
- GIVEN a test deliberately exercises an error boundary or persistence failure
- WHEN the expected logger call occurs
- THEN the test asserts the call and suppresses only that expected emission.

#### Scenario: Unexpected console error appears
- GIVEN no allowlisted assertion owns a console error
- WHEN required Jest CI emits it
- THEN the signal-integrity gate fails or explicitly classifies it before release certification.

### Requirement: Toolchain warnings are maintained deliberately

GitHub Actions and Node runtime warnings MUST be removed where an available compatible action/tool version exists; unavoidable warnings MUST be documented.

#### Scenario: Action runtime deprecation has a compatible upgrade
- GIVEN CI reports that an action targets a deprecated Node runtime
- AND a compatible supported action major exists
- WHEN Campaign 016 hardens CI
- THEN the action is upgraded and required workflows remain green.

### Requirement: Test CI emits a machine-readable summary

Required test CI MUST emit a concise machine-readable summary containing passed, failed, skipped, and classified warning counts.

#### Scenario: Final certification parses test summary
- GIVEN the final App CI run
- WHEN the certification artifact is produced
- THEN pass/fail/skip counts and warning classification are available without scraping ambiguous prose.

### Requirement: Performance suites are separate but executable

Opt-in performance tests MAY remain outside ordinary correctness CI but MUST have a documented command or job that actually executes them.

#### Scenario: Ordinary CI skips performance probes
- GIVEN performance suites are intentionally gated
- WHEN ordinary correctness CI runs
- THEN those skips match the allowlist and a separate documented performance command/job can execute them with the required probe flag.
