# Game SDK Contract — Bootstrap Requirements

**Status:** design requirements; concrete TypeScript API is Phase 1 work.

Every production game must integrate through the shared SDK rather than reinventing cross-cutting infrastructure.

## Required concepts

- stable game ID
- primary library category + optional secondary domains
- metadata/version
- player-facing named difficulty
- internal difficulty parameters/challenge rating
- deterministic seed/generator version
- session start/pause/resume/complete/abandon lifecycle
- monotonic/high-resolution timing service
- normalized score/result representation
- domain-rating contribution
- XP participation/performance contribution
- tutorial state/help
- audio/haptic hooks
- semantic automation IDs
- structured diagnostic metadata
- QA fixture/state forcing

## Persistence rule

Completed sessions must be atomically committed. Abandoned sessions do not update cognitive skill ratings and award no/negligible XP. Process-killed active sessions restart rather than requiring exact restoration.

## Pause rule

Pause freezes relevant timers and obscures challenge content behind a strong opaque blur/overlay.

## Generator rule

Procedural games must be reproducible by `(game version, generator version, seed, difficulty/config)` where practical.

## Scoring rule

A game owns raw scoring, then converts to a documented normalized performance representation before shared rating updates.

## Swarm rule

A game module should be independently implementable/testable by one coder packet without concurrent edits to other game modules. Shared registry/index changes should be generated or integrated by the orchestrator.
