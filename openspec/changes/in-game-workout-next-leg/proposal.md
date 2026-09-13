# Proposal — In-game workout next-leg

## Why

Today's Workout does not advance when a workout-launched game finishes. In-game `GameResults` only offers Play again / Done (`router.back()`). Durable advance (`WorkoutRepository.advanceForSession`) runs solely on the `/results` history route, which the player reaches from Home's recent-session list. After Done, Home's Continue control replays the same leg. This violates the locked 006r sequential-workout requirement (compact result with Next Game; must not return Home between legs) and constitution §14's four-game workout as a continuous session.

## What Changes

- After a workout-launched session **successfully persists**, the in-game results surface MUST advance that workout leg (same CAS/`advanceForSession` path already used by `/results`) and offer **Next Game** for remaining legs, or workout-completion behavior on the last leg.
- Done/back MUST NOT be the only path between workout legs.
- `/results` MUST remain idempotent: opening it later MUST NOT double-advance.
- Autobot daily-workout journey MUST drive Next Game from in-game results instead of encoding a Home detour as the product path.

No scoring, generator, or persistence-format changes.

## Capabilities

### New Capabilities

- `in-game-workout-advance`: in-game results advance a workout-owned session and present Next Game / completion without routing Home between legs.

### Modified Capabilities

- (none in `openspec/specs/` — this repository has no main spec tree. 006r `daily-workout` Sequential workout flow remains the locked requirement this change implements.)

## Impact

- `apps/mobile/src/components/game-host/results.tsx` (`GameResults` actions)
- Game screens' `onQuit` / results wiring (42 modules via shared `GameResults`)
- `apps/mobile/src/workout/use-workout-result-advance.ts` and `db/workout.ts` `advanceForSession`
- `apps/mobile/src/app/results.tsx` (idempotent second view)
- `scripts/qa/autobot.mjs` `flowWorkout`
- Tests: game-host results, a representative screen, workout advance CAS, Home continue-after-in-game-done

## Out of scope

- Changing workout selection, reroll economics, or provenance tuple shape
- Full-catalog `--mode certify` (environment)
- Constitution-deferred systems

## Evidence

- `GameResults` props are `onRestart` / `onQuit` only; Memory (and siblings) pass `onQuit={quitToLibrary}` → `router.back()`.
- `useWorkoutResultAdvance` is imported only by `app/results.tsx`.
- Autobot `flowWorkout` documents BACK Home → recent row → `/results` as the journey.
- 006r `openspec/changes/006r-core-integrity-correction/specs/daily-workout/spec.md` Requirement: Sequential workout flow.

## Dependencies

None. Independent of the other frontier-audit proposals.

## Intended outcome

A player who starts Today's Workout and finishes game N sees Next Game (or completion) on the in-game results screen; Home Continue never offers the same unadvanced leg after a successful persist.
