# Progress and Analytics Correctness — Delta Spec

## ADDED Requirements

### Requirement: Rating history records applied movement
When rating floors/caps alter requested movement, history MUST store the actual applied delta (`after - before`) and resulting rating.

#### Scenario: Clipped movement records applied delta
- GIVEN a requested rating movement altered by floors/caps
- WHEN history is written
- THEN it stores the actual applied delta (`after - before`) and resulting rating.

### Requirement: Rating freshness uses evidence time
Staleness/freshness MUST derive from the latest contributing gameplay evidence time, not merely the time an old session was imported/reprocessed.

#### Scenario: Freshness tracks evidence time
- GIVEN an old session imported/reprocessed recently
- WHEN staleness is computed
- THEN freshness derives from the latest gameplay evidence time, not the import time.

### Requirement: Streak uses activity dates, not arbitrary session limit
Home/Profile streak computation MUST use all required distinct local activity dates or an equivalent canonical daily activity representation. It MUST remain correct when a player completes many sessions per day.

#### Scenario: Fifty-day dense streak
- GIVEN 5 sessions/day for 50 consecutive days
- WHEN Home and Profile compute streak
- THEN both report the same 50-day streak rather than a value limited by the latest 30 sessions.

### Requirement: Results loads exact session rating history
For a selected session, Results MUST query rating movements by that session ID (or equivalent exact key) rather than filtering only a fixed-size global history window.

#### Scenario: Results query by session ID
- GIVEN a selected session beyond a fixed global history window
- WHEN Results loads rating movements
- THEN it queries by the exact session ID/key rather than only the window.

### Requirement: Transparent overall composite
Progress MUST expose one documented overall performance/cognitive composite derived from domain ratings with deterministic treatment of unseen and stale domains. It MUST be explainable and separate from engagement level/XP.

#### Scenario: Composite explains domain treatment
- GIVEN domain ratings including unseen and stale domains
- WHEN Progress computes the overall composite
- THEN it is a single documented, explainable value treating unseen/stale deterministically and separate from XP/engagement.

### Requirement: Recent games are real data
Home's Recent Games surface MUST render persisted recent activity when available rather than a permanent placeholder.

#### Scenario: Recent games shows persisted activity
- GIVEN persisted recent activity exists
- WHEN Home renders Recent Games
- THEN it shows the persisted activity rather than a permanent placeholder.