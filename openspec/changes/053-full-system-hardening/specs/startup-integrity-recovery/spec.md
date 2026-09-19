## Purpose

Ensure the app never disguises a failed foundational bootstrap as a ready,
trustworthy brain-training experience and can recover deterministically.

## ADDED Requirements

### Requirement: Foundational bootstrap truthfulness
The system SHALL distinguish foundational initialization of the game catalog and
canonical progression from ancillary preference initialization. It SHALL NOT
present the normal ready application shell when a foundational stage fails. It
MUST instead present an honest recovery-safe state that does not invite normal
play or progression-sensitive actions until that stage succeeds.

#### Scenario: Foundational progression initialization fails
- **WHEN** canonical progression initialization fails during startup
- **THEN** the user is shown a recovery-safe state rather than the normal ready shell and the failure is categorized for diagnostics

#### Scenario: Foundational registration initialization fails
- **WHEN** game catalog registration fails during startup
- **THEN** the user is shown a recovery-safe state that prevents catalog-dependent play until registration succeeds

### Requirement: Deterministic bootstrap recovery
The system SHALL offer a deterministic recovery path for a failed foundational
startup stage. A successful retry or cold relaunch MUST converge to the normal
ready shell without duplicating seeded progression, registrations, currency, or
other persistent effects.

#### Scenario: Retry succeeds after transient failure
- **WHEN** a failed foundational startup stage later succeeds on retry
- **THEN** the normal ready shell is presented exactly once with canonical progression state intact

#### Scenario: Relaunch succeeds after transient failure
- **WHEN** a cold relaunch can complete a previously failed foundational startup stage
- **THEN** the app reaches the normal ready shell without duplicate initialization effects

### Requirement: Ancillary preference isolation
The system SHALL keep a failure to read or apply an ancillary user preference
from blocking an otherwise successful foundational bootstrap. It MUST use a
safe default or retained valid preference state and record the failure without
misclassifying the application as fully degraded.

#### Scenario: Theme preference read fails
- **WHEN** the theme preference cannot be read after foundational initialization succeeds
- **THEN** the app presents the normal ready shell using a safe appearance state and records an ancillary diagnostic

### Requirement: Bootstrap fault coverage
The system SHALL provide deterministic non-production fault coverage for each
foundational bootstrap stage and at least one ancillary stage, so the ready,
safe, retry, and relaunch outcomes are independently verifiable.

#### Scenario: Isolated bootstrap stage fault is injected
- **WHEN** a test injects a failure into one bootstrap stage while the others succeed
- **THEN** the asserted startup state corresponds to that stage's foundational or ancillary classification
