# Audit map — 059-persistence-transaction-atomicity

**Program SHA:** `428d293` · **Predecessor:** `058-product-ux-navigation-residuals` (VALIDATED)

## Evidence chain

1. Reroll CAS → `db/workout.ts:applyReroll` (full-snapshot WHERE +
   `WorkoutWriteConflictError`) · `use-workout.ts` baseline threading +
   refresh/rethrow · tests: stale-baseline throw + row untouched + honest
   retry (workout-v2), hook conflict propagation (use-workout).
2. Init hygiene → `db/index.ts` (close-on-failure, `createAdapter` seam,
   janitor wiring) · `init-retry.test.ts` (fail-once closes exactly the
   failed adapter; retry clean).
3. Contiguity → `db/migrate.ts` (applied-range gap check) ·
   migration-robustness gappy test (no writes, version untouched).
4. Janitor → `deleteEmptyWorkoutInstances` + boot wiring · mixed-fixture
   tests (4 purged incl. completed-corrupt, healthy intact,
   countCompleted healed, healthy no-op).
5. Focused suites green (db workout/v2/migrations/matrix/robustness/
   init-retry, workout hook/lifecycle/reroll/templates, economy); typecheck;
   lint; OpenSpec strict.

## Census claims closed by design evidence (no change)

- Preview/replace trigger window: boot `ensureSchemaGuards` heals before
  traffic; kill window covered by `migration-v10-hardening` tests.
- Quest/achievement fan-out: monotonic-MAX / INSERT-OR-IGNORE + periodic
  re-sync (self-healing); adapter forbids nesting.
- Export exclusive txn: documented point-in-time consistency mechanism.
- v12 repair: zero observed occurrences; recompute needs MIN-replay.
- Snapshot torn reads: accepted LOW (generous-direction, monotonic, rare;
  adapter has no read-txn by design).
- Legacy advance/persistRepaired/reconcile: deterministic idempotent
  writes; UI bypass already removed (056).
- Read-txn adapter support: deliberate interface boundary, not a gap.

## Residuals (post-adversarial corrections)

- Quest mid-loop kill: transient partial progress until next sync (LOW).
- Reroll overlap: Home coalesces UI double-tap (pre-existing guard); any
  programmatic overlap throws honestly via CAS and the hook refreshes +
  propagates for a user retry — there is no silent double-apply and no
  auto-retry (LOW).
- Paid overlap at the same attempt resolves as silent idempotent dedupe
  (operationId, before CAS is reached); CAS in the paid path covers
  advance-races with fresh operationIds. Both safe (LOW).
- v12 recompute, snapshot isolation, read-txn support: 065+/hardening
  considerations, not 059 scope.
- Empty-catalog selection: fails bootstrap before workout loads, so no
  legitimate empty row is produced; the janitor only ever meets corruption
  in practice (LOW, documented in code).

## Boundaries

Manual/platform/store/CI per program. No UI/route/game change.
