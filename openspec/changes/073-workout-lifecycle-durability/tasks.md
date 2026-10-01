# Tasks — 073-workout-lifecycle-durability

## 1. One compare-and-set for workout position writes

- [ ] 1.1 Extract the advance path's compare-and-set preconditions
      (`status='active'`, current index, updated-at, reroll attempt, seed
      version, stored leg-list shape and bounds) into one shared helper in
      `apps/mobile/src/db/workout.ts`.
- [ ] 1.2 Migrate `advanceForSession` onto the helper with no behavior change.
- [ ] 1.3 Migrate `applyReroll` onto the helper, closing its missing
      `status='active'` condition and missing shape/bound validation.
- [x] 1.4 **Partially done and proven:** a reroll against a completed workout is
      rejected and leaves the row byte-identical (asserted). Mutation-verified —
      removing the `status = 'active'` predicate from the reroll CAS fails this
      case. The malformed/over-bound leg-list rejection and the two-concurrent-
      advances case are NOT yet covered; see 1.1/1.2/1.3, which are the
      prerequisite for covering them honestly.

## 2. Durable leg ownership

- [ ] 2.1 Derive a session's workout-leg ownership from the provenance persisted
      in its stored raw result, not solely from the in-process launch map.
- [ ] 2.2 Keep the launch map as a fast path, but treat it as an assertion:
      ownership requires persisted provenance.
- [ ] 2.3 Assert that a session with no persisted provenance can never advance a
      workout leg, including a standalone session launched during a workout.
- [ ] 2.4 Run the existing session-advance and workout lifecycle suites and
      confirm no regression in exactly-once advance or the campaign-056
      substitute-and-preserve behavior.

## 3. Skip / abandon transition

- [ ] 3.1 Add an additive `skipped` leg state to the workout persistence model
      (idempotent migration; existing rows default to unchanged).
- [ ] 3.2 Add a free, explicit skip action to the workout UI, distinct from
      completion and from reroll, with a visible remaining allowance.
- [ ] 3.3 Ensure a skipped leg awards no completion rewards, and that the
      participation path does not scale with skipped legs.
- [ ] 3.4 Define and communicate the behavior when the allowance is exhausted.
- [ ] 3.5 Add tests: skip is recorded as skipped, advances per the defined rule,
      charges nothing, awards nothing for that leg, and the completed legs
      reward exactly once.

## 4. Honest "Up next" launch

- [ ] 4.1 In `apps/mobile/src/app/(tabs)/index.tsx`, stop launching a future leg
      with an index that claims to be the current leg; either record an explicit
      jump or label the launch as a preview.
- [ ] 4.2 Derive the "Game N of M" indicator in the game host from the stored
      workout position, not from the launch tuple.
- [ ] 4.3 Align the Home progress copy with the stored position.
- [ ] 4.4 Add tests for the indicator and the copy under both the normal and the
      jumped case.

## 5. Startup reconciliation

- [ ] 5.1 Add a bounded reconciliation that scans for sessions carrying
      persisted workout provenance whose leg is behind the stored position, and
      advances the position forward to the highest such leg.
- [ ] 5.2 Run it where the app already reconciles at boot; make it idempotent
      and side-effect free with respect to rewards.
- [ ] 5.3 Ensure a leg with no completed session is left current — reconciliation
      never advances past unfinished work.
- [ ] 5.4 Add tests: position behind a persisted completion is reconciled;
      already-consistent state is unchanged; reconciliation never grants rewards;
      running it twice changes nothing.

## 6. Verification

- [ ] 6.1 `npx jest src/workout src/db` green; the full matrix green with no new
      skips; the jest signal validator passes.
- [ ] 6.2 `npm run typecheck` and `npm run lint` clean.
- [ ] 6.3 On the dedicated AVD, force-stop the app in the window between session
      commit and leg advance, relaunch, and confirm the workout position is
      reconciled and the leg is not replayed.
- [ ] 6.4 On the dedicated AVD, complete a workout leg, skip the next, and finish;
      confirm the summary matches the stored state and the skipped leg awarded
      nothing.
- [ ] 6.5 Confirm standalone sessions still never claim a workout leg, and that
      exactly-once advance still holds under a repeated relaunch.
