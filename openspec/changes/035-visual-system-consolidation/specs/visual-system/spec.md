# Cross-Surface Visual System

## ADDED Requirements

### Requirement: Single-game identity heroes preserve action hierarchy

Game Detail and GameHost intro MUST use the shared neutral hero surface for
the primary identity context. Domain color MAY identify the game through its
existing motif/category cue, but MUST NOT make a competing full-card accent
when the global primary Play/Start action is present.

#### Scenario: Player opens a game detail

- **WHEN** a player opens a registered game with a domain identity
- **THEN** the game identity, mechanic, mastery context, and Play action remain
  visible in their existing order
- **AND** the hero surface is neutral in light and dark themes
- **AND** the domain cue remains visible in the identity mark or category copy.

#### Scenario: Player opens a GameHost intro

- **WHEN** a player reaches a game intro
- **THEN** difficulty, tutorial, QA, and Start controls retain their existing
  behavior and semantic IDs
- **AND** the intro hero uses the neutral shared surface
- **AND** the game family/domain cue remains discoverable without duplicating a
  title-equal category label.

### Requirement: Visual consolidation does not alter game correctness

The visual-system slice MUST NOT change game mechanics, scoring, session
identity, persistence, registry metadata, or reward/economy writes.

#### Scenario: Player starts a game after visual consolidation

- **WHEN** the player activates the existing Start or Play action
- **THEN** the same route, tutorial, difficulty, and session seams are used as
  before the visual change.
