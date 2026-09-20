# Change 056 — Workout Lifecycle Integrity

**Status:** IN_PROGRESS
**Predecessor:** `055-signal-arcade-desirability` (VALIDATED)
**Program SHA:** `428d293`
**Theme:** 056–058 product and behavioral completeness (workout behavior, recovery states, navigation, result correctness).

## Problem / evidence

The overnight census (7 read-only lanes, base `428d293`) proved five workout-lifecycle defects against current source. Each was verified by reading the exact code, not inferred from docs.

1. **Reconcile grants unplayed completion credit (HIGH).** `reconcileWorkout`
   (`apps/mobile/src/workout/reconcile.ts:117`) truncates retired game ids and
   marks the instance `"completed"` when the clamped index reaches the end of
   the shortened list. Live repro with the frozen catalog: any persisted
   instance whose last unplayed leg is `language-word-match` (frozen out of
   workouts via `EXCLUDED_FROM_WORKOUT`, `reconcile.ts:34`) completes without
   the leg ever being played — e.g. `gameIds=[a,b,c,word-match]`,
   `currentIndex=3` → `gameIds=[a,b,c]`, `currentIndex=3`, `status=completed`.
   `countCompleted` (`db/workout.ts:196-209`) then counts it, feeding streaks
   and `workout-completions` achievements for a workout that was never
   finished. The truncating repair also rewrites already-played history when a
   played leg's game is later retired.
2. **Leg-index envelope bound contradicts the real catalog (MEDIUM).**
   `MAX_ROUTE_LEG_INDEX = 31` (`routing/route-params.ts:41-42`) while the
   longest supported workout is 6 games (`extended`, `templates.ts:65-67`;
   daily `WORKOUT_SIZE = 4`, `today.ts:23`), i.e. max leg index 5 — the
   comment even claims 8, which is wrong on both counts. Indices 6..31 pass
   the envelope, fail `ownsCurrentLeg` (`db/workout.ts:117-128`), and persist
   as standalone sessions with no user-visible signal that workout linkage
   was lost.
3. **Unconditional `advance()` is exposed to UI without ownership proof
   (MEDIUM).** `WorkoutRepository.advance()` (`db/workout.ts:295-312`) moves
   the resume pointer with no session, and `useWorkout()` returns it
   (`workout/use-workout.ts:317-322,339`). Production completion correctly
   uses `advanceWorkoutForSession` → `advanceForSession` (conditional,
   ownership-checked); the hook-level `advance` has zero production callers
   (only tests) but remains a one-call footgun that can skip an unplayed leg
   and break the exactly-once invariant claimed in `session-advance.ts:1-11`.
4. **Corrupt/empty `gameIds` can complete (MEDIUM).** `rowToInstance`
   (`db/workout.ts:85-114`) degrades corrupt `game_ids_json` to `[]`; on such
   a row `advance()` computes `min(index+1, 0) = 0 >= 0` → `"completed"`,
   which `countCompleted` counts. The reconcile path already heals this
   (`null` → delete → regenerate), but the direct write path does not.
5. **Launch-map recovery contract is unpinned (LOW).** Ownership at persist
   time comes from the in-memory launch map (`session-provenance.ts:33-94`)
   unless the record carries explicit provenance. Re-registration after a
   restart (fresh map + same route params) re-establishes ownership, and a
   failed transaction keeps the map for retry (`sessions.ts:562-567`) — but
   no test pins either contract, so a future refactor can silently break
   restart recovery.

## Desired invariant / outcome

- Reconcile **never grants credit for unplayed legs** and **never rewrites
  played history**: the played prefix `[0, currentIndex)` is immutable;
  retired future legs are deterministically substituted from the eligible
  pool (registry order, excluding present ids) to preserve instance length;
  truncation + auto-complete happens only when no eligible substitute exists
  (degenerate pool exhaustion).
- Completed stays completed: reconcile never resurrects a completed
  instance, and never completes an empty one.
- The route envelope accepts exactly the leg indices real workouts can own
  (`0..5`), derived from one shared constant; provenance validation enforces
  the same upper bound plus length caps.
- No UI-reachable path advances a workout leg without proving session
  ownership; the only advance paths are `advanceForSession` (conditional)
  and explicit test/db primitives.
- Empty/corrupt workout rows cannot transition to `completed` via direct
  writes; they heal through regenerate.
- Restart recovery (re-register from route params; retry keeps map) is
  pinned by contract tests.

## Non-goals

- No scoring, rating, XP, currency, economy, schema/migration, backup format,
  gameplay, offline, or router-architecture change.
- No new workout lengths, templates, selection-algorithm, or reroll-economy
  change (substitution reuses the eligible pool order; it does not reseed or
  rerank).
- No encrypted backups, no backend sync, no store/manual/platform evidence.
- `language-word-match` stays frozen out of selection (its semantics fix is
  separate work); this change only stops drift-repair from mis-reporting.

## Affected areas

`src/workout/reconcile.ts`, `src/workout/session-provenance.ts`,
`src/routing/route-params.ts`, `src/db/workout.ts`,
`src/workout/use-workout.ts`, `src/workout/session-advance.ts` (audit only),
`src/workout/use-workout-result-advance.ts` (audit + persist-if-changed),
focused tests + `route-params`/`session-provenance`/`workout` suites.

## Protected contracts

Game SDK lifecycle, scoring/normalization, session atomicity + idempotency
(`sessions.ts:410-567`), rating/currency authority, `advanceForSession`
conditional semantics, `ownsCurrentLeg`, backup/import/export validation,
offline behavior, unexpected-console baseline, generated registry, six-way
responsive/a11y expectations, dark-mode intent.

## Implementation plan

1. `reconcile.ts`: preserve played prefix; substitute retired future legs
   deterministically; complete only when nothing playable remains or the
   instance was already completed; `null` only when the repaired list is
   empty; never mutate inputs; keep pure + deterministic.
2. Shared max-leg constant (`templates.ts` game counts are the authority):
   envelope bound `31 → 5`; `isWorkoutSessionProvenance` upper bound +
   string length caps; update pinned tests.
3. Remove ownership-bypassing `advance` from the `useWorkout` public return;
   migrate hook-level tests to `db.workouts.advance` + `refresh()`; keep the
   db primitive (test/template use) with legacy documentation intact.
4. Guard `advance`/`applyReroll` against empty `gameIds` (throw, never
   complete); verify reconcile-null → regenerate in all load paths.
5. Pin recovery contracts: restart re-registration test; retry-keeps-map
   test; explicit-provenance-without-map test; substitution idempotency +
   determinism tests; no-auto-complete regression tests (word-match-shaped
   fixtures); envelope rejection tests for indices 6..31.
6. Audit every `reconcileWorkout` consumer for display-vs-durable skew when
   substitution changes the list (persist when changed in async paths).

## Test plan

- Updated `workout/__tests__/reconcile.test.ts` (old truncation expectations
  replaced with substitution + history-preservation expectations).
- New regression suites for substitution, bounds, guards, recovery.
- Focused workout/routing/db suites green; then full gated Jest, typecheck,
  lint, validators, OpenSpec strict.
- Risk-based native: substitution is pure + covered by unit contracts; run
  the standard release-smoke only if the change touches the artifact path
  (it does not change game/route UI).

## Runtime/native evidence plan

None beyond repository gates: no game/route UI, schema, or artifact change.
If any consumer audit forces a UI-visible change, escalate to the standard
release smoke (install, Home/Games/Detail, one workout leg, relaunch) before
closing.

## Rollback / risk notes

- Substitution changes what `reconcile()` persists for drifted rows; the
  previous truncation behavior is preserved in Git history and the repair is
  deterministic, so a revert restores exact prior semantics.
- The main regression risk is display-vs-durable skew at pure-`reconcile`
  call sites; mitigated by the consumer audit (step 6) and by substitution
  determinism (re-running converges instead of churning).

## Completion criteria

- All implementation tasks done; new + updated contracts green.
- Full gated Jest + typecheck + lint + Expo Doctor + all repo validators +
  OpenSpec `--changes --strict` pass with exact counts recorded.
- Adversarial review performed; substantiated findings repaired.
- Durable state (ledger, STATE, VALIDATION) reconciled; coherent commit(s)
  pushed; `HEAD == origin/main`; no temp worktrees/branches/stashes.
