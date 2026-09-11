# HUD Round Progress — Delta Spec

## ADDED Requirements

### Requirement: R1 Round position in the HUD

A game whose session has a known, finite number of rounds/trials MUST report its
position to the shared chrome (`GameHost` `roundProgress`), so the session HUD
shows progress rather than only a label.

#### Scenario: Bounded session

- GIVEN a game with `totalRounds`/`totalTrials` (or equivalent) in its state
- WHEN a round is in progress
- THEN the HUD renders a progress element reflecting completed vs total units,
  with an accessible value.

### Requirement: R2 Open-ended sessions stay honest

A game with an open-ended or time-boxed session MUST NOT report fabricated
progress; it keeps its round/label presentation.

#### Scenario: Endless game

- GIVEN a game whose session ends on time or on failure rather than a fixed
  round count
- WHEN the session runs
- THEN no fake denominator is displayed.

### Requirement: R3 Chrome contract preserved

Adding progress MUST NOT remove or rename existing game testIDs or the accessible
name of the HUD, and MUST NOT change scoring.

#### Scenario: Harness selectors

- GIVEN the automation harness selectors for the game (`<game>.round.*`,
  `<game>.score`, `<game>.pause`)
- WHEN the HUD renders with progress
- THEN every selector still resolves.
