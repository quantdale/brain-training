# Persistence Integrity — Delta Spec

## ADDED Requirements

### Requirement: Numeric persistence domains are explicit

Public persistence writes MUST reject non-finite, fractional, unsafe, or
out-of-domain values before they can become SQLite rows or rewards.

#### Scenario: Fractional duration or reward input

- GIVEN an INTEGER-declared duration, XP, ledger, rating, or timestamp field
- WHEN a caller supplies a fractional or unsafe value
- THEN the write fails and no partial authoritative state is committed.

### Requirement: Replay identity is durable

Session completion and rating/reward side effects MUST be idempotent by stable
identity, including duplicate delivery and imported replay data.

#### Scenario: Same session is completed twice

- GIVEN a session id already committed
- WHEN the same completion is delivered again
- THEN the stored session and side effects remain unchanged.

### Requirement: Rating history has a natural identity

The database MUST prevent more than one rating movement for the same session
and domain, while preserving deterministic repair of known legacy duplicates.

#### Scenario: Legacy duplicate rows are migrated

- GIVEN duplicate `(session_id, domain)` rows in a pre-migration database
- WHEN the forward migration runs
- THEN one deterministic keeper remains, the unique identity is enforced, and
  the append-only guard is restored.
