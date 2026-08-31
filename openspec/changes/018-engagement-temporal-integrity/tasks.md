# Tasks — Campaign 018 Engagement Temporal Integrity

## 1. Input and calendar boundaries

- [ ] 1.1 Audit quest progress, definition, claim, and period-key inputs.
- [ ] 1.2 Reject malformed numeric/timestamp quest progress before SQLite
      writes and preserve monotonic completion semantics.
- [ ] 1.3 Canonicalize streak covered dates and reject impossible calendar
      dates without dropping valid legacy coverage.

## 2. Reward and projection consistency

- [ ] 2.1 Exercise future unlock/completion/session claim attacks through every
      inbox and direct-claim path.
- [ ] 2.2 Reconcile Home, Rewards, workout, and progression reads across local
      date rollover and catalog drift.
- [ ] 2.3 Verify reward claims remain idempotent under retry and failure.

## 3. Verification and closure

- [ ] 3.1 Run focused real-DB engagement and calendar suites.
- [ ] 3.2 Run the complete current-head test/static validation matrix.
- [ ] 3.3 Record exact PASS/NOT VALIDATED/BLOCKED evidence and close 018 only
      after durable state, OpenSpec, and ownership agree.
