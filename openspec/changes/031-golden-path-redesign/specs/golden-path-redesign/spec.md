# Golden-path redesign specification

## ADDED Requirements

### Requirement: Today has one dominant decision

Home MUST make Today’s Workout the dominant surface and expose one primary
Start/Continue action with length, progress, current/next leg, and concise
context. Reroll/configuration and engagement systems MUST remain secondary.

#### Scenario: A player opens an active daily workout

- **WHEN** Home is loaded with a persisted active workout
- **THEN** the Today surface presents one dominant Continue action, the saved
  progress position, and the current/next game context
- **AND** streak, XP, coins, reroll, and discovery surfaces do not compete as
  equal primary actions

### Requirement: Workout handoff remains durable

Starting or continuing from Home MUST use the existing persisted instance and
exact workout provenance. A presentation change MUST NOT create, reseed, or
duplicate an instance.

#### Scenario: A player starts or resumes Today

- **WHEN** the player activates the Home Start/Continue action
- **THEN** navigation uses the existing workout instance and its exact leg
  provenance
- **AND** returning before game start leaves the persisted instance unchanged

### Requirement: Intro teaches before play

The game intro MUST present identity, one concise mechanic sentence, relevant
difficulty/reward context, tutorial access where applicable, and one `Start
game` action. Tutorial persistence MUST remain unchanged.

#### Scenario: A workout-owned game opens

- **WHEN** a game route is opened with a valid workout provenance tuple
- **THEN** the intro identifies the game and workout position, presents a
  concise mechanic sentence, and offers one Start game action
- **AND** the existing tutorial store still controls first-use/replay behavior

### Requirement: Gameplay remains focused

Active play MUST keep the board and essential progress/timer context primary,
with one Pause affordance. Existing reducers, generators, scoring, lifecycle,
session identity, and deterministic QA controls MUST remain intact.

#### Scenario: A player is in an active game

- **WHEN** the gameplay shell is rendered
- **THEN** the board and essential HUD remain available with one Pause action
- **AND** no redesign code changes the game reducer, generator, scoring, or
  lifecycle contract

### Requirement: Results explain then continue

Results MUST order outcome headline, one or two performance facts, bounded
persisted reward feedback, and one primary continuation. An active workout MUST
make `Next game` primary and show its title/position. A final workout MUST show
`Workout complete`, an explicit completion total, and make `Finish workout`
primary. Standalone results MUST retain a context-appropriate Play again/Done
path.

#### Scenario: An active workout leg is completed

- **WHEN** the persisted session succeeds and the durable CAS advance returns a
  next leg
- **THEN** Results presents the outcome and facts before the bounded reward,
  shows the next game and position, and makes Next game the primary action
- **AND** Next game uses the returned exact provenance tuple

#### Scenario: The final workout leg is completed

- **WHEN** the persisted session succeeds and the durable advance marks the
  workout complete
- **THEN** Results presents Workout complete with the saved total and makes
  Finish workout the primary action
- **AND** revisiting the result does not perform another completion write

### Requirement: Completion is idempotent

Revisiting or relaunching a completed path MUST NOT duplicate session, reward,
XP, rating, workout-advance, or completion writes. Home MUST reflect the saved
completed state.

#### Scenario: A completed workout is relaunched

- **WHEN** the app is killed and relaunched after final completion
- **THEN** Home and the workout history reflect the saved completed instance
- **AND** no duplicate session, reward, XP, rating, advance, or completion
  record is created

### Requirement: Changed surfaces remain accessible

Changed actions MUST meet the repository touch target and preserve text
scaling, semantic IDs/order, light/dark equivalence, reduced motion, and
non-color state communication.

#### Scenario: A player uses a changed surface with accessibility settings

- **WHEN** the golden path is rendered in light/dark mode or with reduced
  motion/text scaling
- **THEN** the primary action remains reachable, semantically labelled, and
  visually equivalent in both themes
- **AND** the existing 44dp shared control floor and stable QA IDs remain
  available
