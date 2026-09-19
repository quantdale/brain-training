## Purpose

Provide executable, catalog-wide assurance that failed or stale game-session
persistence cannot create duplicate progression, rewards, or actionable state.

## ADDED Requirements

### Requirement: Registry-derived persistence matrix
The test system SHALL derive persistence contract cases from the registered
game catalog rather than maintain an unverified representative subset. Every
registered game MUST be covered by the standard contract or listed in an
explicit, reviewed exemption with its alternate evidence.

#### Scenario: New registered game lacks contract coverage
- **WHEN** a game is present in the runtime registry but absent from the standard matrix and exemption list
- **THEN** the catalog persistence contract validation fails with the game identity

#### Scenario: Registered game uses the standard contract
- **WHEN** a registered game supports the shared session persistence fixture surface
- **THEN** the matrix executes its declared success and failure contract cases for that game

### Requirement: Failed persistence safety
For every non-exempt registered game, a failed session persistence attempt SHALL
leave progression, currency, workout completion, and durable session history
without a duplicate or partially applied completion effect. The user MUST be
given an honest recoverable outcome rather than an actionable completed state.

#### Scenario: Game session save is rejected
- **WHEN** a registered game's session persister rejects completion
- **THEN** no duplicate durable completion or reward is applied and the visible result state communicates that progress was not saved

### Requirement: Stale completion isolation
For every non-exempt registered game, a late completion result from an ended or
restarted session SHALL NOT mutate the active session or apply progression,
currency, workout, or history effects to it.

#### Scenario: Prior session resolves after restart
- **WHEN** a game session is restarted before an earlier persistence attempt resolves
- **THEN** the earlier result cannot make the restarted session appear completed or apply duplicate durable effects

### Requirement: Explicit exemption evidence
The test system SHALL require every exception to the shared persistence matrix
to name the game, state why the shared fixture cannot apply, and identify a
deterministic alternate success/failure/stale-completion evidence path.

#### Scenario: Exception is proposed without alternate evidence
- **WHEN** a game is added to the exemption list without a deterministic alternate contract
- **THEN** catalog persistence contract validation fails
