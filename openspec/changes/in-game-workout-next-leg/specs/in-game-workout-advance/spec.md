## ADDED Requirements

### Requirement: In-game results advance a workout-owned session
When a session launched with workout provenance successfully persists, the in-game results surface MUST invoke the same durable `advanceForSession` CAS used by `/results` before offering the next navigation. Advance MUST NOT run if persist failed.

#### Scenario: Persist success advances the current leg
- GIVEN a daily workout instance at index 0 of 4 and a session persisted with matching provenance
- WHEN in-game results observe persist success
- THEN `advanceForSession` commits index 1 (or completion at the last leg) and a later `/results` view of the same session does not advance again

#### Scenario: Persist failure does not advance
- GIVEN a workout-launched session whose persist rejected
- WHEN in-game results render the failure
- THEN the workout `currentIndex` is unchanged

### Requirement: Next Game is offered without returning Home
For a workout-owned session that is not the last unplayed leg, in-game results MUST present a Next Game control that launches the next provenance tuple. Done/back MUST NOT be the only path between legs. After the last leg, the surface MUST offer workout-completion behavior rather than Continue-the-same-game on Home.

#### Scenario: Next Game after an early leg
- GIVEN workout games 1–4 unplayed and game 1 just persisted
- WHEN the player is on in-game results
- THEN a Next Game control is present and activating it opens game 2 with the next provenance; the player is not required to visit Home

#### Scenario: Last leg completes the workout
- GIVEN the workout at the last unplayed index
- WHEN that session persists and advance succeeds
- THEN the instance status is completed and the results surface offers completion behavior, not Next Game

### Requirement: Home Continue never replays an already-persisted current leg
After a successful in-game persist+advance, Home's primary Continue control MUST target the new current game (or completion), not the game just finished.

#### Scenario: Continue after Done
- GIVEN the player finished workout game 1 in-game and returned Home
- WHEN they activate Continue
- THEN the launched game is workout index 1, not index 0
