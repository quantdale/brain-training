# Progress and Analytics Correctness — Delta Spec

## ADDED Requirements

### Requirement: Rating history records applied movement
When rating floors/caps alter requested movement, history MUST store the actual applied delta (`after - before`) and resulting rating.

### Requirement: Rating freshness uses evidence time
Staleness/freshness MUST derive from the latest contributing gameplay evidence time, not merely the time an old session was imported/reprocessed.

### Requirement: Streak uses activity dates, not arbitrary session limit
Home/Profile streak computation MUST use all required distinct local activity dates or an equivalent canonical daily activity representation. It MUST remain correct when a player completes many sessions per day.

#### Scenario: Fifty-day dense streak
- GIVEN 5 sessions/day for 50 consecutive days
- WHEN Home and Profile compute streak
- THEN both report the same 50-day streak rather than a value limited by the latest 30 sessions.

### Requirement: Results loads exact session rating history
For a selected session, Results MUST query rating movements by that session ID (or equivalent exact key) rather than filtering only a fixed-size global history window.

### Requirement: Transparent overall composite
Progress MUST expose one documented overall performance/cognitive composite derived from domain ratings with deterministic treatment of unseen and stale domains. It MUST be explainable and separate from engagement level/XP.

### Requirement: Recent games are real data
Home's Recent Games surface MUST render persisted recent activity when available rather than a permanent placeholder.