# Change 059 — Persistence & Transaction Atomicity

**Status:** IN_PROGRESS
**Predecessor:** `058-product-ux-navigation-residuals` (VALIDATED)
**Program SHA:** `428d293`
**Theme:** 059–061 structural quality and deep invariants.

## Problem / evidence

Verified against source at `5598dfb`. Three census HIGHs were CLOSED by
design evidence during verification (recorded so they stay closed):

- Preview/replace trigger window: `ensureSchemaGuards` heals missing
  guards on EVERY boot before traffic (`migrate.ts:80-98`, wired in
  `initializeDatabase`), and the crash-window kill is covered by
  `migration-v10-hardening` tests. No change.
- Quest/achievement fan-out: every write is monotonic-MAX /
  INSERT-OR-IGNORE idempotent and re-sync runs periodically — a kill
  mid-loop self-heals on the next sync. No outer-txn refactor (the adapter
  forbids nesting; threading txns through repos is disproportionate).
- Export exclusive write txn: the documented consistency mechanism for a
  point-in-time backup (`serialize.ts:111-115`). Reader latency is the
  accepted price; weakening it risks torn backups. No change.
- v12 rating repair without recompute: last-resort path with zero observed
  occurrences; recompute must replay MIN-floored deltas (not a plain sum).
  Accepted debt, not scope.
- Achievement-snapshot torn reads: generous-direction, monotonic, rare;
  fixing needs read-txn support the adapter deliberately lacks. Accepted
  LOW.

Real gaps fixed here:

1. **Free-reroll blind write (MEDIUM).** `applyReroll` reads then writes
   unconditionally (`db/workout.ts:381-406`). A completion landing between
   the read and the write resurrects a just-played leg into the future
   (the paid path shares the flaw inside its txn). Unlike
   `advanceForSession`, no ownership/version check exists.
2. **Init re-open leak on retry (MEDIUM).** `initializeDatabase`
   (`db/index.ts:196-207`) opens a new native connection per pass and never
   closes the failed pass's adapter; bootstrap retry after a migration/
   profile failure leaks the handle (lock/contention risk on the recovery
   path — the worst place for it).
3. **Migration set gap silence (LOW).** The runner sorts + dup-checks but a
   gappy set would silently skip a version while `user_version` advances
   past it. The shipped set is pinned contiguous by test; the runner should
   fail fast independent of the set.
4. **Corrupt empty workout rows linger (MEDIUM).** `rowToInstance` degrades
   corrupt `game_ids_json` to `[]`; active empties heal via reconcile, but
   completed/never-loaded empties are counted by `countCompleted` forever
   (056 residual F8). Empty rows carry no games — nothing to preserve.

## Desired invariant / outcome

- Reroll transitions are compare-and-swap on the row read: concurrent
  advance/reroll loses loudly (refresh + honest error) instead of
  resurrecting played legs. Paid atomicity (debit + transition) preserved.
- A failed init pass closes the adapter it opened; retries never stack
  native connections. Success-path behavior byte-identical (no instance
  reuse change — tests rely on fresh DBs).
- Gappy migration sets fail fast at startup validation, never silently.
- Boot heals corrupt empty workout rows (any status) with a count for
  evidence; `countCompleted` can no longer include them.

## Non-goals

- No trigger-flow, quest-sync, export-lock, v12-repair, or snapshot
  changes (documented above).
- No schema migration, no backup-format change, no economy change.
- No read-txn adapter support (deliberate interface boundary).
- Seed migration (→ 060).

## Affected areas

`db/workout.ts` (`applyReroll` CAS + janitor), `workout/use-workout.ts`
(conflict refresh/rethrow), `db/index.ts` (close-on-failure + factory
seam), `db/migrate.ts` (contiguity), focused tests.

## Protected contracts

Paid-reroll atomicity + operationId dedupe, advanceForSession
conditionality, reconcile semantics (056), migration per-version
atomicity, boot-heal behavior, console baseline, offline, registry.

## Implementation plan

1. `applyReroll` with optional `RerollBaseline` (hook passes its selection
   snapshot): canonical list-compare in JS, then `UPDATE ... WHERE date=?
   AND reroll_attempt=? AND current_index=?`; mismatch or `changes===0` →
   throw `WorkoutWriteConflictError`. Paid + free paths inherit (paid rolls
   back the debit too; same-attempt paid overlap dedupes earlier by
   operationId). Hook catches conflict → `refresh()` + rethrow for a user
   retry (existing error surfacing, no auto-retry).
2. `initializeDatabase`: try/catch — on failure close the opened adapter
   (best-effort) then rethrow. Add `options.createAdapter` seam (default:
   current expo opener). Test: fail-once factory → close observed; retry
   succeeds on a fresh adapter.
3. `runMigrations`: after sort/dup checks + current read, assert the
   applied range `(current, maxApplicable]` is contiguous (fail fast
   naming the gap). Lone custom sets and partial targets keep working.
   Test with gappy custom set (shipped set unaffected) + lone/partial
   carve-outs.
4. `deleteEmptyWorkoutInstances(adapter): Promise<number>` in
   `db/workout.ts` (module fn on SQLiteAdapter): parse every row's
   `game_ids_json`; delete rows whose list is empty (covers `[]`, corrupt
   JSON, non-arrays) in one txn; return the count. Wire into
   `initializeDatabase` after `ensureSchemaGuards`. Tests: mixed corrupt/
   healthy rows of both statuses; count; healthy intact; completed count
   drops accordingly.
5. Full matrix + adversarial review + close.

## Test plan

- CAS: concurrent stale-snapshot double applyReroll → second throws;
  honest retry succeeds; paid-path rollback intact (existing economy
  tests); hook conflict test (refresh + propagate).
- Init: fail-once factory closes exactly the failed adapter; retry clean.
- Migrations: gappy custom set throws naming the missing version.
- Janitor: mixed fixtures; count; no healthy touched; countCompleted healed.
- Full gated Jest + console gate + typecheck + lint + validators +
  OpenSpec strict.

## Runtime/native evidence plan

No UI/route/game change: repository gates + debug-build bundle proof if
the tree state warrants (059 touches no game/route code; build covered by
057 canary + 067 certification).

## Rollback / risk notes

- CAS: any legitimate double-apply with a stale attempt now throws instead
  of silently overwriting — callers re-read and retry (the only two
  callers do). Existing sequential tests unaffected (fresh reads).
- Close-on-failure: best-effort close in a failure path; cannot break the
  success path (untouched).
- Janitor deletes definitionally-corrupt rows (import rejects them;
  selection never creates them); count returned for evidence.

## Completion criteria

Standard terminal bar + per-item tests green + full matrix exact counts +
adversarial review + pushed + `HEAD == origin/main`.
