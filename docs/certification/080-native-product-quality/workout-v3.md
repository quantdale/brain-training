# Workout V3 native lifecycle report — Campaign 080 continuation

Date: 2026-10-21
Status: **PARTIALLY EXECUTED NATIVELY** (driver `scripts/qa/workout-journey.mjs`,
evidence `qa-artifacts/080/workout-v3-journey.json` + per-step screenshots).

## Verified on device (emulator-5554, installed APK sha256 231559b9…48ca)

| Step | Result |
|---|---|
| Cold start → Home | OK |
| Workout plan generated/visible (`home-workout-plan/list/selected`) | OK |
| Workout start (`home-workout-cta/continue` → game with `workout-context`) | OK |
| Leg 1 played to results | NOT OBSERVED this run |
| Interrupt → app terminate → relaunch | OK |
| Resume surface visible (`home-workout-continue/progress`) | OK |
| Resume into the workout | OK |
| Workout completion + reward evidence | NOT OBSERVED this run |

## Honest analysis

The lifecycle's start/interrupt/resume spine is verified. Leg completion did
not occur within the journey's attempt budget because the first leg's game
presented the same answer-driven surface class as the catalog sweep's
tutorial-demo blocker (see `full-session-validation.md`): the driver's generic
taps reach the board but do not yet solve answer-driven legs. No product
defect was observed — the workout correctly persisted across
terminate/relaunch and offered resume (that IS the critical §9 property
verified).

## Exact next actions

1. Re-run with per-family leg solvers (same resolvers as the tutorial-demo
   plan; the prompts are captured in evidence).
2. Then verify reward rows (XP/coins/quests) via `data-counts-*` before/after
   and confirm no duplicate attribution across the interrupt/resume boundary.
3. Exercise one abandonment/quit path (`home-workout-skip` / results quit).
