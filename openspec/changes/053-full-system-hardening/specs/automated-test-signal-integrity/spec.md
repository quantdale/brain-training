## Purpose

Make automated test output a trustworthy regression signal by repairing known
asynchronous-test defects and separating asserted error behavior from noise.

## ADDED Requirements

### Requirement: Settled asynchronous UI assertions
The test system SHALL wait for and assert asynchronous UI effects through the
test framework's supported synchronization mechanisms. A test MUST NOT leave
known React update or overlapping action warnings as normal passing output.

#### Scenario: Deferred UI update is exercised
- **WHEN** a test triggers a deferred component update
- **THEN** the test waits for the observable settled result without emitting an uncontrolled React update warning

### Requirement: Scoped expected-error handling
The test system SHALL make deliberately exercised persistence or recovery error
paths explicit and scoped to the responsible test. It MUST preserve visibility
of unexpected console errors and warnings instead of globally suppressing them.

#### Scenario: Expected persistence failure is tested
- **WHEN** a test intentionally causes a persistence failure
- **THEN** the expected diagnostic is asserted or scoped by that test and does not appear as indistinguishable suite noise

#### Scenario: Unexpected console error occurs
- **WHEN** a test emits a console error or warning outside an approved, asserted scope
- **THEN** the test signal identifies it as an actionable failure or baseline regression

### Requirement: Explicit nonfunctional probe status
The test system SHALL identify intentional opt-in performance probes separately
from ordinary functional coverage. Disabled probes MUST have an explicit enable
condition and MUST NOT be reported as silently skipped functional guarantees.

#### Scenario: Performance probe is disabled by default
- **WHEN** the standard CI test command runs without the performance-probe opt-in
- **THEN** output and validation records identify the omitted probe as intentional and distinguish it from a functional test skip

### Requirement: Deprecated test API removal
The test system SHALL replace known deprecated test-framework invocation
patterns with supported equivalents before treating test output as a clean
baseline.

#### Scenario: Existing deprecated query option is exercised
- **WHEN** the affected confirmation-path test runs
- **THEN** it uses a supported waiting/query interface and emits no known deprecation warning
