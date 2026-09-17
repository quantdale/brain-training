# Design — Campaign 034

## Evidence-led baseline

The native baseline was captured before source edits on `emulator-5554` in
light and dark with one persisted session. Profile showed a large Local player
card, a streak card, claim buttons inside motivation lists, and a full
cosmetics gallery below the fold. Rewards showed a claimable inbox, collection
progress, the full cosmetic gallery, and reward history. Source tracing
confirmed that `src/rewards/inbox.ts` already unifies achievement, quest, and
streak-milestone claims through the existing once-only claim primitives.

## Ownership model

| Profile group | Owns | Does not own |
| --- | --- | --- |
| Local player | identity, equipped identity summary, quiet level/XP context | cosmetic catalog/equip actions |
| Motivation | streak rhythm, protection controls, quest/achievement/milestone status | reward claim writes |
| Rewards | pending count/entry point | — |
| Data | data-management route entry | portability implementation |
| Settings | theme and sensory controls | — |

Rewards remains the single first-class owner of pending inbox claims, claim-all,
cosmetic purchase/equip, and reward history. Profile status rows use
"available in Rewards" language so a completed objective has one next action.

## Data and correctness

The Profile pending count reuses the existing `collectClaimableRewards` read
collector so it includes completed quest periods outside the active Profile
list. It adds no schema or write path. If that engagement read is unavailable,
Profile remains usable and falls back to the local current-period status count.
Rewards continues to re-derive claimability at claim time and owns all canonical
claim writes. On focus return Profile reloads the same persisted state, so a
claim made in Rewards is reflected without a local duplicate cache.

## Accessibility and automation

The existing Profile test IDs remain on identity, motivation, streak,
settings, data, and the established cosmetics entry row. New grouping and
pending-state IDs identify the Rewards card/entry/meta. Read-only status uses
text and badges rather than hidden disabled buttons; the actual claim controls
remain reachable in Rewards with their existing labels.
