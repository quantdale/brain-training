# Pause Timekeeping — Delta Spec

## ADDED Requirements

### Requirement: Paused time is excluded from active gameplay time

Manual pause, background auto-pause, tutorial coverage, and resume MUST NOT
grant additional active deadline or session elapsed time.

#### Scenario: Deadline is paused mid-window

- GIVEN a 1000 ms active deadline with 400 ms already elapsed
- WHEN the app pauses for an arbitrary duration and resumes
- THEN only the remaining 600 ms of active time can fire the deadline.

### Requirement: Timer cleanup is complete

Deactivation and unmount MUST clear intervals/timeouts so a terminal screen
cannot receive orphan gameplay events.

#### Scenario: Terminal screen unmounts

- GIVEN an active game timer
- WHEN the game deactivates or unmounts
- THEN advancing the clock produces no further gameplay callback.
