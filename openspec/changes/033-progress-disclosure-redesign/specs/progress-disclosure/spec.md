# Progress disclosure requirements

## ADDED Requirements

### Requirement: Answer-first Progress overview

The populated Progress overview MUST present selected-window consistency,
recorded movement with sample context, and one evidence-backed next
consideration before the deeper analytics stack.

#### Scenario: Returning player reads the overview

- **WHEN** a player with recorded sessions opens Progress
- **THEN** the selected window and trained-day/session summary are visible
- **AND** movement is labeled as recorded evidence with sample context
- **AND** one domain consideration includes a plain reason and a path to detail

### Requirement: Honest sparse and insufficient states

The Progress overview MUST distinguish no selected-window sessions from a
single-session insufficient movement sample and MUST NOT present an initial
rating as an achieved performance result.

#### Scenario: New player opens Progress

- **WHEN** no sessions are stored
- **THEN** the empty state explains how ratings start without calling the value
  a result

#### Scenario: One session is selected

- **WHEN** exactly one session falls inside the selected window
- **THEN** the overview says that movement cannot be described yet

### Requirement: Deep history remains reachable

The redesign MUST preserve the existing Progress Activity, domain, game
history, Game Detail, and advanced analytics routes and MUST NOT alter their
persistence or scoring contracts.

#### Scenario: Player requests more detail

- **WHEN** the player activates a domain consideration or existing history row
- **THEN** the existing detail destination opens without losing the route's job

### Requirement: Runtime and accessibility evidence

Campaign completion MUST include real rendered Android light/dark evidence,
sparse and populated states, automated accessibility checks, and honest
classification of unavailable human/platform validation.

#### Scenario: Campaign closes

- **WHEN** the change is marked validated
- **THEN** its evidence package records the actual checks and limitations

