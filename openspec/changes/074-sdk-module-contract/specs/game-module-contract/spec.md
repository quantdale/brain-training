# Game Module Contract

## Purpose

Define the observable guarantees that a game module satisfies the interface the
host relies on before it is ever rendered, that a live session cannot be started
twice, and that per-game lifecycle behavior is genuinely verified rather than
inferred from shared sources.

## ADDED Requirements

### Requirement: A non-conforming game module fails before it can render

The system SHALL validate every game module's exported surface against the
interface the host depends on, before that module is made available for
rendering. A module that omits or misspells a required export SHALL be reported
as a catalog integrity failure naming the module and the missing member, and
SHALL NOT be loaded into a playable state.

The rendering host SHALL NOT need an unchecked conversion in order to supply the
surface a module provides. The surface a module is given by the host SHALL be
part of that module's declared interface.

#### Scenario: Module omits a required export

- **GIVEN** a game module that does not export a required member of the game
  module interface
- **WHEN** the catalog is validated and the module is registered
- **THEN** registration reports a catalog integrity failure
- **AND** the failure names the module and the missing member
- **AND** the module is not available for rendering

#### Scenario: Module misspells a required export

- **GIVEN** a game module whose required export exists under a different name
- **WHEN** the catalog is validated and the module is registered
- **THEN** registration reports a catalog integrity failure naming the member
      that is missing
- **AND** it does not proceed to a runtime failure inside the game

#### Scenario: Conforming module

- **GIVEN** a game module that satisfies the game module interface
- **WHEN** the catalog is validated and the module is registered
- **THEN** registration succeeds
- **AND** the module renders with the surface the host supplies

#### Scenario: The host supplies the declared surface

- **GIVEN** a game module rendered by the host
- **WHEN** the host supplies the tutorial state and the module consumes it
- **THEN** that supply is expressed through the module's declared interface
- **AND** no unchecked conversion is required to make the types agree

### Requirement: A live session cannot be started twice

Starting a session SHALL fail if a previous session over the same scope is still
non-terminal. The refusal SHALL leave the previous session's state, timers, and
persistence intact, and SHALL be distinguishable from a successful start.

#### Scenario: Duplicate start attempted

- **GIVEN** a session that has started and is still in a non-terminal phase
- **WHEN** a start is requested for the same session scope
- **THEN** the second start is refused
- **AND** the first session remains active and unaffected
- **AND** the refusal is distinguishable from a successful start

#### Scenario: Start after the previous session ended

- **GIVEN** a previous session that has reached a terminal phase
- **WHEN** a new start is requested for the same scope
- **THEN** the new session starts normally

#### Scenario: Abandoned start

- **GIVEN** a start that fails after partially initializing
- **WHEN** a later start is requested
- **THEN** the partial state does not block the later start
- **AND** no timer, listener, or subscription from the failed start remains
      active

### Requirement: Per-game lifecycle behavior is verified per game

The contract that games obtain their lifecycle from the shared host rather than
creating their own SHALL be verified for each game module individually. A
verification whose result is satisfied by the presence of shared host sources
SHALL NOT be reported as evidence about an individual game.

#### Scenario: A game introduces its own lifecycle primitives

- **GIVEN** a game module that creates its own timers, intervals, or event
  subscriptions outside the shared host primitives
- **WHEN** the per-game lifecycle verification runs
- **THEN** the verification fails and names the module and the construct

#### Scenario: A game uses the host primitives

- **GIVEN** a game module that obtains its lifecycle only from the shared host
  primitives
- **WHEN** the per-game lifecycle verification runs
- **THEN** the verification passes for that module
- **AND** the result is specific to that module

#### Scenario: A new game is added

- **GIVEN** a new game module has been added to the catalog
- **WHEN** the per-game lifecycle verification runs
- **THEN** the new module is included in the verification
- **AND** a non-conforming module fails the verification

### Requirement: Version metadata conversion matches the documented contract

A version identifier SHALL be converted to its persisted numeric form according to
the documented contract, including the case where a game has no applicable
version for a field the contract declares optional. A conversion that rejects a
documented-permitted input SHALL be corrected, and the conversion's
documentation SHALL describe the components it actually packs.

#### Scenario: Game with no applicable version

- **GIVEN** a game whose content is not produced by a versioned generator
- **WHEN** the game's version metadata is converted for persistence
- **THEN** the conversion accepts the absent version the contract permits
- **AND** no exception is raised

#### Scenario: Packable version

- **GIVEN** a game with a versioned generator
- **WHEN** the version metadata is converted for persistence
- **THEN** the numeric result is derived from the documented components
- **AND** the same input always produces the same result

#### Scenario: Documentation matches behavior

- **GIVEN** the conversion's documentation
- **WHEN** it is read
- **THEN** the components it claims to pack are the components it packs
