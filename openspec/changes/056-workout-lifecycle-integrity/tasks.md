# Tasks — 056-workout-lifecycle-integrity

- [x] 1. Pure repair: rewrite `reconcileWorkout` to substitute-and-preserve (design algorithm); keep pure/deterministic/no-mutation.
- [x] 2. Bound constant: add `MAX_WORKOUT_LEG_INDEX` (templates authority); wire envelope + provenance validation; update pinned bound tests.
- [x] 3. Hook surface: remove `advance` from `useWorkout` return; migrate lifecycle/reroll-partial to `advanceWorkoutForSession`, use-workout to db-level advance + refresh.
- [x] 4. Direct-write guards: `advance`/`applyReroll` throw on empty `gameIds`; `advance` clamps negative index.
- [x] 5. Consumer audit: persist-when-changed in `session-advance` nav path; post-advance no-op documented; `use-workout-result-advance` effect-persist implemented.
- [x] 6. Regression tests (red→green): substitution (single + multi-slot + order), history immutability, fallback truncation, completed immunity + verbatim, envelope rejection 6..31 + accept 0..5, empty-row throw, restart re-registration via route parser, txn-fault retry-keeps-map, explicit-provenance-without-map, determinism/idempotency, drift-nav persist.
- [x] 7. Update superseded truncation tests honestly; focused suites green (24 suites / 273 tests).
- [ ] 8. Full validation: gated Jest (exact counts), console gate, typecheck, lint, Expo Doctor, repo validators, OpenSpec strict.
- [x] 9. Adversarial review (fresh agent): verdict CLOSE_WITH_FIXES; all 12 findings repaired or honestly disclosed (spec example, completed-verbatim, result-advance persist, fallback comment, multi-slot tests, fallback labels, txn-fault + route-parse tests, drift-nav test, doc nits, residuals F2/F5/F8).
- [ ] 10. Reconcile durable state (ledger, STATE, VALIDATION), commit, push, verify `HEAD == origin/main`, no temp worktrees/branches/stashes.
