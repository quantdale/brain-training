# Tasks — 059-persistence-transaction-atomicity

- [x] 1. `applyReroll` CAS (canonical list-compare + attempt/index WHERE) + `WorkoutWriteConflictError`; hook baseline threading + refresh/rethrow; conflict + retry tests.
- [x] 2. Init close-on-failure + `createAdapter` seam + fail-once leak test.
- [x] 3. Migration applied-range contiguity fail-fast + gappy + lone/partial tests.
- [x] 4. Empty-workout janitor + wiring + mixed-fixture tests.
- [x] 5. Adversarial CLOSE_WITH_FIXES repaired (raw-bytes predicate → canonical-compare, spec/design/audit wording, carve-out tests, comment corrections).
- [x] 6. Full matrix (572 suites / 6,825 tests / 5 snapshots, exit 0) + typecheck + lint + validators + OpenSpec strict 43/43; durable state; commit; push.
