## ADDED Requirements

### Requirement: Tutorial completion survives process death
Production gameplay MUST read and write `tutorial_state` through the database repository (or a write-through adapter over it). Completing or QA-skipping a tutorial MUST skip first-play on the next cold start of that game.

#### Scenario: Complete then relaunch
- GIVEN a first-play tutorial is completed on game `memory`
- WHEN the process is killed and the game is opened again
- THEN `shouldShowTutorial('memory')` is false until replay is requested

#### Scenario: Never seen still shows
- GIVEN no `tutorial_state` row for a game
- WHEN the player opens it the first time
- THEN the first-play tutorial is shown

### Requirement: Replay from help still works
Help/info replay MUST set `replayRequested` durably so the tutorial shows once more after restart, then returns to skipped after completion.

#### Scenario: Replay persists
- GIVEN a completed tutorial
- WHEN the player requests replay from help and the app restarts before they finish it
- THEN the tutorial is shown on next launch

### Requirement: QA skip remains dev-only
`skipForQa` MUST still throw outside `__DEV__`. Production builds MUST NOT expose a skip that writes completion without playing the tutorial.

#### Scenario: Production skip refused
- GIVEN a production (`__DEV__ === false`) build
- WHEN `skipForQa` is invoked
- THEN it throws and `tutorial_state` is unchanged

### Requirement: Backup round-trip includes gameplay writes
Export/import MUST continue to carry `tutorial_state` rows that gameplay actually wrote (not only rows written by tests).

#### Scenario: Export after complete
- GIVEN the player completed a tutorial in production
- WHEN they export then wipe then import
- THEN that game does not show first-play tutorial
