# Storage Adapter Concurrency

## Purpose

Define the observable contract of the application's SQLite adapter for
transaction re-entrancy, statement serialization, and connection-level
invariants, so that a persistence defect is reported as a deterministic error
on every runtime rather than as a device-only permanent hang that the test
harness reports as green.

## ADDED Requirements

### Requirement: Re-entering a transaction from inside a transaction body is rejected, never queued

When a call made from inside a transaction body is routed to the adapter that
owns that transaction — that is, the caller did not thread the transaction
adapter through to the repository call — the adapter SHALL reject the call with
a descriptive error. It SHALL NOT block waiting for the outer transaction, and
it SHALL NOT silently execute the call outside the transaction.

The same rejection SHALL apply to every adapter entry point that re-enters the
owning connection: beginning a nested transaction, and executing a
connection-level statement (for example a DDL or `PRAGMA` call) from inside a
transaction body.

#### Scenario: Nested transaction through the owning adapter

- **GIVEN** an open transaction on a connection
- **WHEN** code inside the transaction body begins a new transaction through the
  adapter that owns the open transaction
- **THEN** the inner call is rejected with a descriptive error
- **AND** the outer transaction either commits its own work or rolls back
  completely, with no statement from the rejected call applied
- **AND** subsequent independent statements on that connection still complete

#### Scenario: Non-transactional statement through the owning adapter during a transaction

- **GIVEN** an open transaction on a connection
- **WHEN** code inside the transaction body executes a connection-level
  statement through the adapter that owns the open transaction
- **THEN** the call is rejected with a descriptive error rather than queued
  behind the transaction
- **AND** the outer transaction remains completable

#### Scenario: Transaction-scoped calls still work

- **GIVEN** an open transaction
- **WHEN** the transaction body performs reads and writes through the
  transaction adapter it was given
- **THEN** those calls execute inside the transaction
- **AND** the adapter does not report re-entrancy for them

#### Scenario: Both runtimes agree

- **GIVEN** the same nested-transaction call is made against each supported
  storage backend
- **WHEN** the call is issued
- **THEN** each backend rejects it with an error identifying nested transaction
  use
- **AND** neither backend resolves the call by blocking indefinitely

### Requirement: The adapter documents and enforces its single-writer contract

The adapter SHALL serialize statements issued against the same underlying
database handle, including across distinct adapter instances that resolve to
the same handle. The adapter SHALL expose the guarantee that a completed
statement never has its native statement resource released while another
in-flight call is still preparing one.

#### Scenario: Distinct adapters over one handle

- **GIVEN** two adapter instances created over the same underlying database
  handle
- **WHEN** statements are issued from both concurrently
- **THEN** the statements do not overlap on the handle
- **AND** neither call fails with a released-shared-object error

#### Scenario: Failed operation does not wedge the connection

- **GIVEN** a statement that fails
- **WHEN** a later independent statement is issued on the same connection
- **THEN** the later statement completes normally

### Requirement: Required connection-level invariants are applied and verified on every backend

The application SHALL establish, at database initialization and before any
migration runs, the connection-level settings its correctness depends on:
foreign-key enforcement, a non-zero busy timeout, and an explicit journal mode.
Initialization SHALL fail loudly if a required setting cannot be applied or
does not take the expected value.

The verification surface SHALL be exercised against every supported backend so
that a backend cannot report success for a connection that lacks a setting the
application relies on.

#### Scenario: Settings are asserted at startup

- **GIVEN** a freshly opened database on any supported backend
- **WHEN** initialization completes
- **THEN** foreign-key enforcement is enabled
- **AND** the busy timeout is greater than zero
- **AND** the journal mode equals the mode the application declares
- **AND** a failure to establish any of them is reported rather than ignored

#### Scenario: Foreign keys are enforced inside a transaction

- **GIVEN** an open transaction
- **WHEN** a write violating a declared foreign key is issued through the
  transaction adapter
- **THEN** the write is rejected and the transaction is rolled back

### Requirement: Storage-backend behavioral parity is pinned by tests, not assumed

The repository SHALL maintain an executable contract enumerating the engine
behaviors the application depends on, and SHALL evaluate that contract against
whichever backend is active. A divergence that cannot be converged SHALL be
recorded as a named, owned, known boundary rather than left implicit.

#### Scenario: Ignored writes stay ignored

- **GIVEN** a table with a uniqueness constraint
- **WHEN** a duplicate row is written using an insert-or-ignore form
- **THEN** the write reports that it changed no row
- **AND** the pre-existing row is unchanged

#### Scenario: Constraint violations are not swallowed by an ignore form

- **GIVEN** a table with a check constraint
- **WHEN** a violating row is written using an insert-or-ignore form
- **THEN** the violating row is not persisted
- **AND** the surrounding transaction remains usable

#### Scenario: Engine facts are recorded, not assumed

- **GIVEN** the parity contract
- **WHEN** it runs against a backend
- **THEN** the engine version and the connection-level settings observed for
  that backend are reported
- **AND** a backend that cannot satisfy a required fact fails the contract
