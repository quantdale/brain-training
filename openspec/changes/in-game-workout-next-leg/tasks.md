## 1. Shared advance on persist success

- [ ] 1.1 Extract a reusable `advanceWorkoutForSession(session)` (or reuse `useWorkoutResultAdvance` from GameHost results) so in-game results and `/results` share `advanceForSession` CAS.
- [ ] 1.2 Invoke it only when `persistState === 'succeeded'` and workout provenance is present.

## 2. In-game results chrome

- [ ] 2.1 Extend `GameResults` with Next Game / completion actions; keep Done for standalone sessions.
- [ ] 2.2 Next Game uses `gameHref` + next provenance; last leg shows completion, not another play of the same id.

## 3. Tests and harness

- [ ] 3.1 Test: persist success advances once; remounting `/results` for the same session does not double-advance.
- [ ] 3.2 Test: persist failure does not advance.
- [ ] 3.3 Representative GameHost screen: workout launch → complete → Next Game testID visible.
- [ ] 3.4 Home Continue after in-game persist+advance launches the next leg.
- [ ] 3.5 Update `scripts/qa/autobot.mjs` `flowWorkout` to use in-game Next Game; self-test covers the new node.

## 4. Verification

- [ ] 4.1 `tsc --noEmit` and targeted Jest (game-host, workout, autobot `--self-test`) PASS.
- [ ] 4.2 Do not mark this change implemented until the sequential-workout scenarios pass.
