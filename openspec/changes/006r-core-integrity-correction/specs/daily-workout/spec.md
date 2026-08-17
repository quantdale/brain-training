# Daily Workout and Personalization — Delta Spec

## ADDED Requirements

### Requirement: Workout is a durable four-game session
Today's Workout MUST be represented as a persisted daily instance, normally containing four ordered games. It MUST track current position and completion state across app restart.

### Requirement: Sequential workout flow
Within workout context, completing and successfully persisting game N MUST lead to a compact result with `Next Game` for N < 4. After game 4, the workout MUST become completed and show/offer workout completion behavior rather than returning to Home between games.

### Requirement: Completion advances only after durable session success
A workout position MUST NOT advance merely because local game state reached results. The corresponding completed session must be durably accepted first, preventing a crash from marking unpersisted work complete.

### Requirement: Restart/resume
An interrupted active workout MUST resume from its persisted current index without duplicating already-completed session rewards.

### Requirement: Full-catalog personalization
Personalized workout selection MUST choose from the full eligible catalog before finalizing four games. Ranking/selection MUST account for weakness, neglected/unseen domains, recent-play penalty, previous-day repetition, domain diversity, controlled deterministic randomness, and some stronger-domain variety. Merely reordering four games selected without those signals is insufficient.

### Requirement: Deterministic selection
For identical date, catalog/version, ratings/history, and reroll attempt, workout selection MUST be deterministic.

### Requirement: Durable reroll economics
Reroll attempt count MUST persist per local date. The first permitted reroll is free; subsequent rerolls use transactional currency spending. Restart MUST NOT restore the free reroll or reset the daily limit.

### Requirement: Completed prefix stability
If reroll occurs after one or more workout games are completed, completed positions MUST remain immutable; only future unplayed positions may change.

#### Scenario: Restart after game 2
- GIVEN games 1 and 2 completed and persisted
- WHEN the app is killed and relaunched
- THEN Today's Workout shows 2/4 complete and resumes at game 3
- AND games 1/2 rewards are not re-awarded.