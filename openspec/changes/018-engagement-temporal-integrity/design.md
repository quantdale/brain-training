# Design — Campaign 018 Engagement Temporal Integrity

## Invariants

- Public quest writes accept only non-empty identities, canonical periods,
  finite safe-integer progress, and valid safe-integer completion times.
- Streak coverage stores only real calendar dates in canonical sorted order;
  tolerant reads discard malformed legacy values without inventing activity.
- Claim APIs use one validated as-of `Date` per operation and cannot claim a
  future completion or unlock; duplicate claims remain no-ops.
- Home, Rewards, and workout/progression projections derive from the same
  bounded source-of-truth reads after period rollover and catalog changes.

## Boundaries

Validation belongs at repository/action boundaries, while pure streak transforms
remain side-effect free. Existing tolerant reads continue to heal malformed
legacy settings by omission. No migration is introduced unless a persisted
schema invariant cannot be enforced at the API boundary; SQLite remains the
canonical store.

## Verification

Use real migrated SQLite fixtures for quest/reward/progression paths, pure
property-style tables for date and settings normalization, and targeted source
tests for all engagement callers. Then run the full Node 22 Jest/static gate,
the QA self-test, and the repository validators. Android/manual evidence is
reported separately if the designated device remains unavailable.
