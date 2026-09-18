# Full catalog repeatability and game-lifecycle soak

## ADDED Requirements

### Requirement: Every registered game receives current lifecycle evidence

The campaign MUST evaluate all 42 generated-registry games at detail/start,
first interactive state, result lifecycle, persistence, and navigation return.

#### Scenario: A game cannot complete a required state

- **WHEN** the current runtime or QA support cannot reach a lifecycle stage
- **THEN** the evidence MUST identify the exact stage, preserve the observed
  state/error, and classify the game partial or blocked rather than claiming
  completion.

### Requirement: Deterministic completion is not mechanic coverage

The campaign MUST distinguish deterministic force-win/force-loss/timeout
completion from real interaction with the game's mechanic.

#### Scenario: A repeatability subset is exercised

- **WHEN** a game is selected for repeated interaction
- **THEN** the evidence MUST identify the domain/mechanic, interaction class,
  lifecycle result, and persistence outcome separately.

### Requirement: Durable state remains idempotent after the batch

The campaign MUST inspect SQLite integrity and duplicate/stale durable records
after batch lifecycle runs.

#### Scenario: Repeated results are persisted

- **WHEN** the batch writes sessions, ratings, rewards, or currency operations
- **THEN** integrity, unique identity, and operation idempotency checks MUST
  pass or the campaign MUST stop progression and document the defect.
