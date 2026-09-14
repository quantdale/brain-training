## 1. Shared refresh helper

- [x] 1.1 Extract `refreshProgression(db, now)` used by Profile, Home, Rewards (seed + sync, fingerprint-gated).

## 2. Claimable surfaces

- [x] 2.1 Call it from Home `loadHome` / claimable count before `collectClaimableRewards`.
- [x] 2.2 Call it from Rewards `loadRewards` before inbox collection.

## 3. Wipe / replace call site

- [x] 3.1 After successful `wipeLocalData` in `data-management.tsx`, call `refreshProgression` then refresh UI.
- [x] 3.2 After successful replace-import, call `refreshProgression` if definitions may be missing.

## 4. Tests

- [x] 4.1 Complete a daily-quest session; load Rewards/Home without Profile; item is claimable.
- [x] 4.2 Two loads do not duplicate unlocks/claims.
- [x] 4.3 Wipe via `onWipe` then list quest definitions non-empty and sessions 0 in the same db.
- [x] 4.4 Engine `wipeLocalData` tests remain empty-catalog (pure clear).

## 5. Verification

- [x] 5.1 Targeted Jest (progression, rewards, home, data-management) and `tsc --noEmit` PASS.
