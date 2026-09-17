# Navigation Coherence

## ADDED Requirements

### Requirement: Clean planning copy does not imply nonexistent history

Home MUST use a starting-set description when the current local record has no
completed sessions, and MAY use the existing recent-training description only
when recorded session data supports it.

#### Scenario: New player sees today's workout

- **WHEN** the workout is initialized and the local recent-session list is
  empty
- **THEN** the primary Start workout action remains unchanged
- **AND** the plan line describes the starting set without claiming recent
  training history.

### Requirement: Pushed route back behavior preserves context

The observed Games, Game Detail, GameHost, Results, Progress drill-down,
Rewards, and Data Management routes MUST retain their existing back behavior
and return to the context that launched them.

#### Scenario: Player backs out of a pushed route

- **WHEN** a player opens a detail, result, drill-down, Rewards, or Data route
  from a parent surface and presses Android back
- **THEN** the parent surface returns with its meaningful selection/context
  intact
- **AND** no session or reward mutation occurs merely from navigating back.

### Requirement: Invalid and empty deep links remain recoverable

Unknown game IDs and missing result IDs MUST render a truthful recoverable
state with an existing browse/back action rather than a blank screen or
uncaught error.

#### Scenario: Deep link references missing state

- **WHEN** the app opens an unknown game or result ID
- **THEN** it identifies the missing/empty state
- **AND** it exposes the existing library/back action.

