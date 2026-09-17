# Campaign 034 implementation summary

## Product changes

- Added visible `MOTIVATION`, `REWARDS`, `DATA`, and `SETTINGS` section
  headers on Profile.
- Kept the equipped identity summary and quiet level/XP context in the local
  player card.
- Kept streak, protection inventory, purchase/apply actions, quests, and
  achievement/milestone progress on Profile as motivation context.
- Removed Profile's achievement, quest, and milestone claim handlers and
  replaced claimable status with `In Rewards` badges/copy.
- Removed Profile's duplicate cosmetic catalog while preserving the
  established `profile-cosmetics` automation seam on the Rewards entry row.
- Added `profile-rewards`, `profile-rewards-entry`, and
  `profile-rewards-pending` semantic IDs.
- Left the existing Rewards inbox, claim buttons, claim-all, collection,
  equip/purchase paths, and reward history as the single action owner.

## Correctness boundary

The change is presentation and read-aggregation only. `collectClaimableRewards`
is used to derive a pending count; it does not grant anything. Rewards still
re-derives claimability at claim time and owns canonical writes. The focused
test fake gained the existing quest-list methods needed to exercise that read
collector; no production persistence contract was changed.

## Regression coverage

`profile-purchases.test.tsx` now asserts that Profile exposes one Rewards
entry, shows the pending count, has no direct achievement/quest/milestone
claim controls, and preserves streak-purchase/theme behavior. The existing
Rewards suite remains in the validation matrix.
