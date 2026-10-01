# Tasks — 073-workout-lifecycle-durability

## 1. One compare-and-set for workout position writes

- [x] 1.1 New `apps/mobile/src/db/workout-cas.ts`: `WORKOUT_POSITION_CAS_WHERE`
      (status='active', current index, updated-at, reroll attempt, seed version,
      and the EXACT stored `game_ids_json` bytes), `workoutPositionCasParams`
      (the bindings, in order, so a writer cannot forget a field),
      `workoutCasApplied`, and `applyWorkoutPositionCas`. The SET clause is a
      CLOSED SET (`WORKOUT_POSITION_CAS_SET`) rather than a free string — a
      caller-supplied clause would be an injection surface in the one module
      whose purpose is to be the trusted place a write is composed.
- [x] 1.2 `advanceForSession` migrated; behavior unchanged (its statement already
      carried every predicate the helper now supplies).
- [x] 1.3 `applyReroll` migrated, which is what closes the missing
      `status='active'` condition AND pulls in `updated_at` / `seed_version`
      (its old statement predated them, so it was weaker than the advance in
      three ways, not one). The malformed/over-bound leg-list VALIDATION also
      landed: `requireValidLegList` rejects an empty, non-string, or
      over-`MAX_WORKOUT_GAME_IDS` list, and `storedLegList` validates the RAW
      stored bytes strictly — `rowToInstance` filters corrupt entries so
      history stays readable, but a WRITE aimed at that row must see the
      corruption instead of laundering a shorter list through the conditional
      update. Applied to BOTH position writers (`applyReroll`, `skipToLeg`).
- [x] 1.4 Complete and proven: a reroll against a completed workout is
      rejected and leaves the row byte-identical (mutation-verified — removing
      the `status = 'active'` predicate fails it); malformed/over-bound
      incoming and stored leg lists are refused with nothing written; and two
      concurrent advances for one leg apply AT MOST one move (the loser is
      refused by the connection's transaction scope or loses the CAS). A
      structural guard asserts every POSITION writer (advance, reroll,
      skip/jump, boot reconciliation) routes through the shared helper with a
      closed-set clause.

## 2. Durable leg ownership

- [x] 2.1 Ownership is derived from the provenance persisted in the session's
      stored raw result: `SessionRepository.findSessionOwningWorkoutProvenance`
      resolves the session whose stored tuple is exactly the asserted one
      (instance key + leg index + game id, mirroring `ownsCurrentLeg`), with a
      bounded JSON1 lookup and a bounded-scan fallback for JSON1-less engines.
- [x] 2.2 The launch map stays the write-time fast path (`completeSession`
      decoration, unchanged) but is an ASSERTION for advancement:
      `advanceWorkoutForSession` requires the durable proof before the
      ownership gate, so an evicted launch, a standalone session played during
      a workout, or a forged deep-link tuple cannot advance a leg.
- [x] 2.3 Pinned by `session-advance.test.ts` ("never advances on an asserted
      tuple no persisted session owns" — no advance without evidence, the same
      signal advances once the evidence exists) and the pre-existing standalone
      case.
- [x] 2.4 `src/workout` + `src/db` green (42 suites / 491 tests at the change's
      verification, including the campaign-056 substitute-and-preserve and
      exactly-once advance suites). Test harnesses now play legs the way
      gameplay does — session first, advance after — which is itself the
      regression proof that ownership is read from the store.

## 3. Skip / abandon transition

- [x] 3.1 Schema v13 `addWorkoutSkippedIndicesColumn` (nullable
      `skipped_indices_json`, tolerant readers, legacy rows read as "no skipped
      legs" — same additive pattern as v10 `metadata_json`);
      `WorkoutInstance.skippedIndices` + defensive `parseSkippedIndices`
      (out-of-range/non-integer entries dropped, never fabricated);
      `skipToLeg` writes the skip record and the position move in ONE
      conditional write (`skipTo` SET clause).
- [x] 3.2 Free skip action on the Home plan surface (`home-workout-skip`),
      distinct from completion and from reroll, with the remaining allowance on
      the control.
- [x] 3.3 A skipped leg awards nothing by construction (no session is written,
      so no XP/coins/ledger entry exists to grant) and the allowance rule keeps
      the `workout-completions` achievements unfarmable with zero play: the
      final leg can never be consumed by a skip. Pinned by
      `skip-and-reconcile.test.ts` (ledger and session counts unchanged by a
      skip).
- [x] 3.4 The boundary is defined AND communicated: `skipUnavailableReason`
      states "Play the last game to finish this workout" / "No skips left in
      this workout" / "This workout is already finished" on the control instead
      of hiding it.
- [x] 3.5 `skip-and-reconcile.test.ts` (9 tests): skips recorded as skipped and
      never as completed; jumps record the whole skipped prefix in one write;
      the final leg and completed workouts refuse skips; the played prefix is
      excluded from the skip record; nothing is charged or awarded.

## 4. Honest "Up next" launch

- [x] 4.1 `onJumpToLeg` on Home: the current leg launches with a tuple that is
      true by construction; a LATER leg records an explicit jump
      (`jumpToLeg` → `skipToLeg`, marking the unplayed prefix skipped) before
      the launch tuple is built from the position the row then holds; an
      already-settled leg (played or skipped) launches WITHOUT a tuple, as a
      practice replay whose session cannot claim a settled leg.
- [x] 4.2 `game-host.tsx` derives the "Game N of M" indicator from the STORED
      workout row (`useDbData` over `getByDate`), with the asserted index only
      as the load/unavailable fallback — a stale or forged tuple can no longer
      be presented as the plan's position.
- [x] 4.3 Home's plan copy (per-leg status, hero sublabel "Game N of M",
      progress readout) is derived from the persisted instance, and skipped
      legs read "Skipped" rather than "Done".
- [x] 4.4 `workout-position.test.tsx` (stored position wins over a disagreeing
      tuple; normal case agrees) and `home-skip-copy.test.tsx` (Skipped copy;
      a later-leg tap records the jump before launching; the current-leg tap
      launches without a jump).

## 5. Startup reconciliation

- [x] 5.1 `reconcileWorkoutPositions` (db/workout.ts): for recent active
      instances, reads the leg indices a persisted session proves were played
      (stored provenance, bounded 500-row scan) and walks the resume position
      forward over settled legs only.
- [x] 5.2 Runs at boot beside `deleteEmptyWorkoutInstances` in
      `initializeDatabase`; idempotent (CAS-guarded, and a second pass finds
      nothing to do) and reward-free (it only moves the resume position —
      never sessions, XP, or the ledger).
- [x] 5.3 The walk stops at the first leg with neither a session nor a skip
      record: unfinished work stays current.
- [x] 5.4 Pinned by `skip-and-reconcile.test.ts`: lagged position repaired
      (the kill window: session committed, advance lost); a later-leg session
      with an unfinished leg current does NOT move the position; running twice
      changes nothing; the ledger is untouched.

## 6. Verification

- [x] 6.1 `npx jest src/workout src/db src/app/__tests__ src/analytics
      src/components/game-host` green at the change's checkpoints; full
      repository matrix green with no new skips; jest signal validator passes
      (floors met, 5 classified opt-in skips unchanged).
- [x] 6.2 `npm run typecheck` and `npm run lint` clean.
- [ ] 6.3 **NOT VALIDATED — device lane not available in this environment**
      (adb present but no attached AVD). On the dedicated AVD: force-stop the
      app in the window between session commit and leg advance, relaunch, and
      confirm the workout position is reconciled and the leg is not replayed.
- [ ] 6.4 **NOT VALIDATED — device lane not available.** On the dedicated AVD:
      complete a workout leg, skip the next, and finish; confirm the summary
      matches the stored state and the skipped leg awarded nothing.
- [ ] 6.5 **NOT VALIDATED — device lane not available.** On the dedicated AVD:
      confirm standalone sessions still never claim a workout leg, and that
      exactly-once advance still holds under a repeated relaunch.
