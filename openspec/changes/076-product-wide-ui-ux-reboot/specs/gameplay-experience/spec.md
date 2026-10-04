## Purpose

Ensure every registered brain-training game has a playable, mechanic-specific and accessible presentation for its complete session lifecycle, not merely a shared theme applied to the shell.

## ADDED Requirements

### Requirement: Distinct, playable game boards
Each of the 42 games registered for this change SHALL have an individually reviewed active board and input affordances appropriate to its mechanic. The prompt, interaction, remaining time or progress when relevant, and immediate next action SHALL be legible on supported devices. Shared visual conventions SHALL coexist with meaningful per-game visual identity and interaction, rather than substituting identical cards for different mechanics.

#### Scenario: Distinct domains
- **WHEN** players open representative memory, attention, flexibility, language, logic, math, spatial and speed games
- **THEN** they can identify what to do and interact with each board without relying on instructions obscured by art or a generic panel unrelated to the mechanic.

#### Scenario: Full catalog coverage
- **WHEN** the shipped game registry is enumerated during certification
- **THEN** each registered game has a recorded individual assessment and exercised active-play state; games omitted from the assessment block completion.

### Requirement: Recoverable play lifecycle
Where a game supports tutorial, selection, round feedback, pause/resume, timeout, end-of-session result, and error, the design SHALL distinguish those states, allow the valid next action, and retain existing gameplay/scoring rules. A game SHALL NOT suggest successful reward persistence until the authoritative save succeeds.

#### Scenario: Wrong answer followed by retry
- **WHEN** the player makes an incorrect selection in a game that supports another attempt
- **THEN** the interface identifies the outcome without color alone, explains the available retry or continuation, and leaves the game in a playable state.

#### Scenario: Pause, leave and return
- **WHEN** a player pauses or exits during a workout-owned game
- **THEN** the interface states the consequence of leaving, avoids accidental completion, and preserves the existing workout resume semantics.

#### Scenario: Persistence failure after completion
- **WHEN** a completed session cannot be saved
- **THEN** the result clearly identifies the failure, avoids showing unsaved XP/currency as earned, and provides an appropriate retry or safe exit.

### Requirement: Accessible game interaction
Each game SHALL provide stable semantic identifiers or accessible labels for state and actions, sufficient touch targets or an equally operable alternative, understandable focus traversal, scalable or reflowed text, and non-motion/non-audio cues for critical information. Development-only deterministic seeds and safe fixture paths SHALL remain unavailable in production.

#### Scenario: Device automation and assistive access
- **WHEN** the same seeded game is played using accessibility hierarchy or autonomous device QA
- **THEN** current instruction, interactive choices, feedback and exit controls are identifiable without absolute host-screen coordinates, and the seed does not change production scoring.

#### Scenario: Non-visual or reduced-sensory outcome
- **WHEN** sound/haptics are muted or reduced motion is enabled
- **THEN** answer state and result remain comprehensible in accessible text and static visuals.
