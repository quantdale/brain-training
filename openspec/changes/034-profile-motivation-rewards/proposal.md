# Campaign 034 — Profile, Motivation, Rewards & Ownership Simplification

## Problem

Profile currently presents identity, streak controls, motivation systems,
claim actions, a complete cosmetic gallery, data controls, and settings as one
long inventory. Rewards already owns a unified claim inbox, claim-all, the full
cosmetic collection/equip flow, and reward history. The overlap makes it
unclear where a player should claim a reward or manage a cosmetic.

## Outcome

Group Profile into identity, motivation, rewards, data, and settings. Profile
retains motivation evidence and active streak protection controls, but pending
claim actions and full cosmetics/history have one clear owner: Rewards.

## Scope

- Add visible Profile grouping and a single pending-Rewards entry point.
- Make Profile quest, achievement, and streak-milestone rows read-only status
  with an explicit Rewards destination.
- Remove the duplicate Profile cosmetic gallery while retaining the equipped
  identity summary and existing automation seam.
- Preserve Rewards claim, claim-all, purchase, equip, history, and error paths.
- Preserve Data Management, theme, sound, haptic, sensory, and streak controls.

## Non-goals

No schema, migration, ledger/economy, scoring, rating, gameplay, backup,
restore, export/delete, offline, or dependency redesign.
