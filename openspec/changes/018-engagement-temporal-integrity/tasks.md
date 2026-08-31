# Tasks — Campaign 018 Engagement Temporal Integrity

## 1. Input and calendar boundaries

- [x] 1.1 Audit quest progress, definition, claim, and period-key inputs.
- [x] 1.2 Reject malformed numeric/timestamp quest progress before SQLite
      writes and preserve monotonic completion semantics.
- [x] 1.3 Canonicalize streak covered dates and reject impossible calendar
      dates without dropping valid legacy coverage.

## 2. Reward and projection consistency

- [x] 2.1 Exercise future unlock/completion/session claim attacks through every
      inbox and direct-claim path.
- [x] 2.2 Reconcile Home, Rewards, workout, and progression reads across local
      date rollover and catalog drift.
- [x] 2.3 Verify reward claims remain idempotent under retry and failure.

## 3. Verification and closure

- [x] 3.1 Run focused real-DB engagement and calendar suites.
- [x] 3.2 Run the complete current-head test/static validation matrix.
- [x] 3.3 Record exact PASS/NOT VALIDATED/BLOCKED evidence and close 018 only
      after durable state, OpenSpec, and ownership agree.
