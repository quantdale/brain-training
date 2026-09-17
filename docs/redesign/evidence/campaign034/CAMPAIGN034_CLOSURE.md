# Campaign 034 closure

## Verdict

`CAMPAIGN_034_COMPLETE_READY_FOR_035`

Campaign 034 is validated on the repository's canonical `main` checkpoint.
The closing commit is recorded in Git history after this evidence package is
committed and pushed.

## Scope closed

Profile is now organized as identity, motivation, rewards, data, and settings.
The identity card keeps local level/XP context; streak rhythm and protection
controls remain in Motivation. Achievement, quest, and streak-milestone rows
are read-only status on Profile and point to Rewards. The duplicate full
cosmetic gallery and direct claim writes were removed from Profile. A single
Profile Rewards entry reports the pending inbox count and opens the existing
Rewards route, which remains the owner of claim, claim-all, cosmetic
purchase/equip, and reward-history behavior.

The pending count reuses `collectClaimableRewards` and falls back to the local
current-period count if that read is unavailable. No schema, migration,
scoring, rating, mastery, session, generator, economy, backup/restore,
offline, or game-mechanics code changed.

## Evidence

- Before/after pixel and UIAutomator index: `BEFORE_AFTER_PROFILE.md`.
- Runtime journey, emulator scroll evidence, and fresh log review:
  `RUNTIME_VISUAL_VALIDATION.md`.
- Accessibility result and limits: `ACCESSIBILITY_VALIDATION.md`.
- Persistence and ownership review: `PERSISTENCE_OWNERSHIP_REVIEW.md`.
- Human/platform validation limits: `HUMAN_VALIDATION_PENDING.md`.
- Focused regression source: `apps/mobile/src/app/__tests__/profile-purchases.test.tsx`.

The synchronized start SHA was
`f64df0315e3dd1b7e2d8519c560e3c9aea1bccb0`. All native artifacts remain
outside Git under the paths listed in the evidence documents.

## Validation result

Full Jest, typecheck, lint, repository validators, Android debug
build/install, native light/dark captures, an emulator-local scroll through
Rewards/Data/Settings, the accessibility audit, and a fresh logcat sample
were executed. The four known GitHub push workflows remain classified as
`FAILED BEFORE EXECUTION / EXTERNAL` when they exhibit the previously observed
zero-step Actions/service failure; this is not relabeled as CI success or a
product failure.
