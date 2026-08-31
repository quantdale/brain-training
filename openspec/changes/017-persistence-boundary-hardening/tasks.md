# Tasks — Campaign 017 Persistence Boundary Hardening

## 1. Audit and boundary contract

- [x] 1.1 Inventory session, rating, ledger, XP, workout, profile, sync, and
      portability write paths against the constitution's local-ownership rules.
- [x] 1.2 Add safe-integer/non-negative validation at repository and backup
      deserialization boundaries without coercing malformed data into rewards.
- [x] 1.3 Preserve explicit all-history maintenance APIs while adding validated
      as-of boundaries to user-facing reads.

## 2. Schema and replay integrity

- [x] 2.1 Add forward migrations for integer storage guards and the natural
      rating-history identity; deterministically repair known legacy duplicates.
- [x] 2.2 Make duplicate completion/reward/replay paths idempotent before
      invoking side-effecting rating work.
- [x] 2.3 Add deterministic ordering and tie-break coverage for sessions,
      ratings, ledgers, and conflict records.

## 3. Portability and synchronization

- [x] 3.1 Scope serialized profiles to the canonical local profile identity.
- [x] 3.2 Make replace import atomic and recoverable across trigger and write
      failures; preserve existing data on failed replacement.
- [x] 3.3 Make merge identities source-aware for one-shot XP rewards and retain
      legitimate generic awards.
- [x] 3.4 Add symmetric same-time conflict and no-op cursor regression tests.

## 4. Verification and closure

- [x] 4.1 Run focused persistence, migration, projection, sync, reward, and
      portability suites; repair all regressions exposed by the new bounds.
- [x] 4.2 Run the complete current-head test/static validation matrix after the
      campaign lifecycle checkpoint is recorded.
- [x] 4.3 Record exact PASS/NOT VALIDATED/BLOCKED evidence and close 017 only
      after durable state, OpenSpec, and ownership agree.
