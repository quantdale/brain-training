# Tasks — 060-idempotency-economy-merge-safety

- [x] 1. `ledger.append` OR IGNORE + reselect; forced-interleave + overlap + sequential tests.
- [x] 2. Merge-ownership pins (sequential + forced-interleave) + in-txn ownership re-check closing the latent interleave charge path.
- [x] 3. Full matrix (572 suites / 6,829 tests / 5 snapshots, exit 0) + typecheck + lint + validators + OpenSpec strict 44/44; adversarial CLOSE_WITH_FIXES repaired (F5 race fix); durable state; commit; push.
