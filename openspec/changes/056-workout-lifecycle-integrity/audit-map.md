# Audit map — 056-workout-lifecycle-integrity

**Program SHA:** `428d293` · **Predecessor:** `055-signal-arcade-desirability` (VALIDATED)

## Evidence chain (claim → current source/test)

1. Reconcile auto-complete on drift → `workout/reconcile.ts` (substitute-and-preserve) · `workout/__tests__/reconcile.test.ts` (substitution, fallback, immunity, determinism) · `workout/__tests__/lifecycle.test.ts` (ghost-slot substitution on load).
2. Leg-bound mismatch (31 vs real 5) → `routing/route-params.ts:MAX_ROUTE_LEG_INDEX=5` + `workout/templates.ts:MAX_WORKOUT_LEG_INDEX` · `routing/__tests__/route-params.test.ts` (equality contract, 6/31 rejection).
3. Hook advance bypass → removed from `useWorkout` return + interface · `lifecycle`/`reroll-partial` tests migrated to `advanceWorkoutForSession` (real ownership path), `use-workout` progress simulation to db-level `advance` + `refresh()`.
4. Empty-row completion → `db/workout.ts` guards · `db/__tests__/workout-v2.test.ts` (throw + heal).
5. Provenance bounds → `session-provenance.ts` · `session-provenance.test.ts` (6/31/oversize rejection, restart re-registration).
6. Retry/explicit recovery → `db/sessions.ts:562-567` (unchanged, map kept) · `sessions.test.ts` (validation-failure keep, injected-transaction-fault keep + successful retry, explicit-without-map).
7. Display-vs-durable → `session-advance.ts` persist-when-changed nav path + no-op comment (drift-nav persist test) · `use-workout-result-advance.ts` effect-persist on the non-advance path (once per session, idempotent) · `session-advance.test.ts` green.

## Census findings disposition

- Lane1 #2 (reconcile auto-complete): CLOSED_VERIFIED by (1).
- Lane1 #5 (leg bound): CLOSED_VERIFIED by (2).
- Lane1 #9 (legacy advance bypass): CLOSED_VERIFIED by (3) for UI reachability; db primitive retained for tests/templates with hardened docs.
- Lane1 #1 (map loss on process death): re-investigated against source — restart re-registers from route params and retry keeps the map; no durable hole found. DOWNGRADED to LOW_ACCEPTED_DEBT with recovery contracts pinned by (5)(6).
- Lane4 #9 (corrupt game_ids → empty completable): CLOSED_VERIFIED by (4) + existing reconcile-null path.
- Lane6 #9 (weak provenance bounds): CLOSED_VERIFIED by (5).
- All other census items: NOT IN SCOPE — carried to the 057–066 backlog in the overnight ledger.

## Accepted residuals (honest, bounded)

- **In-flight launched leg across a drift repair (LOW).** If catalog drift is
  repaired (load-time persist) between a leg's launch and its result commit,
  the launched game is substituted and the committed session saves
  standalone; the user replays the substitute. The session itself is never
  lost and no false completion is granted — strictly better than the old
  truncate-and-complete, but a replay can be owed in this rare window.
  Recorded for the 065 adversarial sweep to re-probe.
- **Pre-existing corrupt COMPLETED rows (LOW).** No write path can create an
  empty-completed row anymore (advance/applyReroll throw, reconcile nulls,
  getOrCreate is active-only, import rejects empties), but a historically
  corrupt completed row is counted until healed. Candidate janitor for
  Change 059 (persistence atomicity).
- **Persist-repair failure navigation (LOW).** When the store itself rejects
  writes, navigation uses the repaired shape and linkage degrades to a
  standalone save by design — no crash, no false credit.

## Boundaries (not claimed)

- No native artifact change (pure logic + bounds + hook surface): repository gates are the evidence; no new APK matrix for this change.
- Human/platform/store/CI boundaries remain MANUAL_PLATFORM_PENDING / EXTERNAL per program.
