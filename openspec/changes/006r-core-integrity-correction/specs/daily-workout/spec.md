# Daily Workout and Personalization — Delta Spec

## ADDED Requirements

### Requirement: Workout is a durable four-game session
Today's Workout MUST be represented as a persisted daily instance, normally containing four ordered games. It MUST track current position and completion state across app restart.

#### Scenario: Workout survives restart
- GIVEN Today's Workout is created with four ordered games
- WHEN the app restarts
- THEN the persisted instance retains its current position and completion state.

### Requirement: Sequential workout flow
Within workout context, completing and successfully persisting game N MUST lead to a compact result with `Next Game` for N < 4. After game 4, the workout MUST become completed and show/offer workout completion behavior rather than returning to Home between games.

#### Scenario: Next Game after early games
- GIVEN a workout with games 1-4 unplayed
- WHEN game N (N < 4) completes and persists
- THEN the result shows `Next Game` rather than returning to Home.

#### Scenario: Completion after game 4
- GIVEN a workout at game 4
- WHEN game 4 completes and persists
- THEN the workout is completed and offers completion behavior, not a return to Home.

### Requirement: Completion advances only after durable session success
A workout position MUST NOT advance merely because local game state reached results. The corresponding completed session must be durably accepted first, preventing a crash from marking unpersisted work complete.

#### Scenario: Crash before persistence does not advance
- GIVEN a game reached its results screen locally
- WHEN the session fails to durably persist before a crash
- THEN the workout position does not advance past that game.

### Requirement: Restart/resume
An interrupted active workout MUST resume from its persisted current index without duplicating already-completed session rewards.

#### Scenario: Resume does not duplicate rewards
- GIVEN an active workout interrupted at index 2
- WHEN the player resumes
- THEN it continues from index 2 and does not re-award completed sessions 0-1.

### Requirement: Full-catalog personalization
Personalized workout selection MUST choose from the full eligible catalog before finalizing four games. Ranking/selection MUST account for weakness, neglected/unseen domains, recent-play penalty, previous-day repetition, domain diversity, controlled deterministic randomness, and some stronger-domain variety. Merely reordering four games selected without those signals is insufficient.

#### Scenario: Selection uses weakness and diversity signals
- GIVEN a player profile with weak and neglected domains
- WHEN workout selection runs
- THEN final four games are chosen from the full eligible catalog using weakness, neglect, recent-play penalty, repetition, and diversity rather than a reordered fixed subset.

### Requirement: Deterministic selection
For identical date, catalog/version, ratings/history, and reroll attempt, workout selection MUST be deterministic.

#### Scenario: Same inputs same selection
- GIVEN identical date, catalog/version, ratings/history, and reroll attempt
- WHEN workout selection runs twice
- THEN it produces identical four-game selections.

### Requirement: Durable reroll economics
Reroll attempt count MUST persist per local date. The first permitted reroll is free; subsequent rerolls use transactional currency spending. Restart MUST NOT restore the free reroll or reset the daily limit.

#### Scenario: Free first reroll then paid
- GIVEN the daily reroll count starts at zero
- WHEN the first reroll is used it is free and a second reroll is attempted
- THEN the second spends currency within a transaction and restart does not restore the free reroll or reset the daily limit.

### Requirement: Completed prefix stability
If reroll occurs after one or more workout games are completed, completed positions MUST remain immutable; only future unplayed positions may change.

#### Scenario: Restart after game 2
- GIVEN games 1 and 2 completed and persisted
- WHEN the app is killed and relaunched
- THEN Today's Workout shows 2/4 complete and resumes at game 3
- AND games 1/2 rewards are not re-awarded.