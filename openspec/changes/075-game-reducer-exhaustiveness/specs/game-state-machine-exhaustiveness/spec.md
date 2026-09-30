# Game State-Machine Exhaustiveness

## Purpose

Guarantee that a game state machine's declared action set is fully handled, so
that introducing an action nobody handles fails at build time with a named
missing member rather than silently doing nothing at runtime.

## ADDED Requirements

### Requirement: An unhandled action is a build-time failure

Every game state machine SHALL exhaustively handle every member of its declared
action union. Adding a member to a game's action union without handling it in the
state machine SHALL be a compilation failure that names the unhandled member.

A state machine SHALL NOT contain a fallback branch that silently returns the
current state for an action that is part of its declared union. Such a branch
SHALL NOT be described in code as an exhaustiveness guard, because it provides
no exhaustiveness guarantee.

#### Scenario: New action added without handling

- **GIVEN** a game whose action union is fully handled
- **WHEN** a new member is added to that union
- **THEN** the build fails
- **AND** the failure names the unhandled member

#### Scenario: Handler added for every member

- **GIVEN** a new member is added to a game's action union
- **WHEN** a matching handler is added
- **THEN** the build succeeds
- **AND** the new action produces the transition its handler defines

#### Scenario: Fallback does not claim exhaustiveness

- **GIVEN** a game state machine contains a fallback branch
- **WHEN** its source is read
- **THEN** it is not described as an exhaustiveness guard
- **AND** it is reachable only for input outside the declared union, or is
      absent

#### Scenario: Existing behavior unchanged

- **GIVEN** a game state machine before this requirement
- **WHEN** the exhaustiveness assertion is introduced
- **THEN** the transition produced for every already-declared action is identical
      to its prior transition

### Requirement: Runtime input outside the declared union fails loudly

Input that reaches a state machine but is not a member of its declared action
union — which a well-typed caller cannot produce, and which a persisted or
rehydrated value might — SHALL be handled explicitly. It SHALL NOT silently
return the current state as though the action had been handled.

#### Scenario: Well-typed dispatch

- **GIVEN** a caller dispatching a declared action
- **WHEN** the state machine processes it
- **THEN** the declared handler runs
- **AND** the runtime fallback is not reached

#### Scenario: Out-of-union input

- **GIVEN** an action value that is not a member of the declared union
- **WHEN** the state machine receives it
- **THEN** the situation is reported rather than silently ignored
- **AND** the failure is diagnosable from the report

### Requirement: The requirement is enforced catalog-wide, including new games

A catalog-wide verification SHALL confirm that every game state machine in the
catalog satisfies the exhaustiveness requirement, and SHALL include games added
after this requirement was introduced. The verification SHALL report a specific
module and member on failure.

#### Scenario: Catalog conforms

- **GIVEN** every game in the catalog exhaustively handles its action union
- **WHEN** the catalog-wide verification runs
- **THEN** the verification passes and reports the number of games checked

#### Scenario: A new game is added

- **GIVEN** a new game has been added to the catalog
- **WHEN** the catalog-wide verification runs
- **THEN** the new game is included in the count
- **AND** a new game with a silent fallback fails the verification, naming it

#### Scenario: Verification cannot be satisfied by silence

- **GIVEN** a game whose state machine falls back silently for a declared union
      member
- **WHEN** the catalog-wide verification runs
- **THEN** the verification fails and names the game
