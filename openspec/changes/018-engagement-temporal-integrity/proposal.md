# Proposal — Campaign 018 Engagement Temporal Integrity

## Decision

Harden the engagement layer's remaining input, calendar, reward-claim, and
progression-reconciliation boundaries. This is a correctness campaign over
existing quests, streaks, rewards, and workout projections; it adds no game or
external product system.

## Verified starting point

Campaign 017 validated safe persistence domains and user-facing as-of reads.
The follow-on audit found that quest progress and streak settings still accept
some malformed runtime values, and that these tolerant settings readers need a
canonical date contract so impossible or duplicate coverage cannot influence a
streak. Reward claims now accept an explicit as-of clock and require the
underlying event to be visible at that clock; this campaign will preserve and
extend that contract through all engagement callers.

## Completion definition

018 is complete when malformed quest/streak inputs cannot create authoritative
progress or protection state, reward claims are time-bounded and idempotent,
progression projections reconcile after rollover/catalog drift, and the full
automated validation matrix has been rerun with platform limitations kept
honest.
