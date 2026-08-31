# Proposal — Campaign 019 Game Lifecycle Resilience

## Decision

Harden the shared game lifecycle and Workout V3 ownership seams across the
existing 42-game catalog. The campaign targets stale async callbacks, pause
and timer fairness, unsafe workout-session provenance, and catalog drift. It
does not add a game or broaden product scope.

## Starting evidence

Campaign 017 already added current-session guards, pause-preserving deadline
timers, exact workout-result ownership, and V3 metadata/reconciliation. The
follow-on audit found a remaining unsafe provenance-index boundary and a
non-finite catalog resume-index repair case. This campaign makes those shared
contracts explicit and keeps a source-level tripwire over every catalog screen.

## Completion definition

019 is complete when every game screen is protected against late persistence
callbacks, paused gameplay cannot gain or lose active time, workout results
advance only their exact persisted instance/leg, catalog drift repairs remain
deterministic, and the full automated/static gate is rerun with external
runtime evidence honestly classified.
