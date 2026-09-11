# Board Feedback Consistency — Delta Spec

## ADDED Requirements

### Requirement: R1 Verdict vocabulary

Every game's answer surface MUST present a verdict through at least three
channels: a fill change, a boundary or shape change, and a glyph badge. Colour
alone MUST NOT distinguish outcomes.

#### Scenario: Two boards from different categories compared

- GIVEN a correct answer in any two games from different categories
- WHEN both verdicts are presented
- THEN each shows a soft fill, an accent boundary and a ✓/✕ glyph rather than
  only a colour swap.

### Requirement: R2 Correct answer shown with a wrong pick

Where the mechanic reveals the answer, a wrong pick MUST be shown together with
the correct option, so the player learns the mapping rather than only the error.

#### Scenario: Wrong answer in a reveal-capable game

- GIVEN a game that resolves a round by revealing the answer
- WHEN the player picks a wrong option
- THEN the wrong pick and the correct option are distinguishable in the same
  frame.

### Requirement: R3 Prompt stays visible

Feedback MUST NOT cover the prompt or stem the player was answering.

#### Scenario: Feedback presentation

- GIVEN any game presenting a verdict
- WHEN the verdict is on screen
- THEN the prompt/stem text is still rendered and readable.

### Requirement: R4 Authoritative feedback

Verdict feedback (visual, audio, haptic) MUST be derived from the reducer's
resolved outcome, so an input that arrives after the round resolved cannot
present success while scoring a timeout.

#### Scenario: Late input

- GIVEN a game with a deadline
- WHEN an input arrives after the deadline resolved the round
- THEN the feedback presented is the resolution's outcome, not the input's
  optimistic guess.

### Requirement: R5 Score motion

Score read-outs that change as a result of play MUST animate with
`AnimatedNumber` (tabular figures) instead of jumping.

#### Scenario: Score change

- GIVEN a game whose score increases during a round
- WHEN the score changes
- THEN the displayed value counts to the new value without reflowing the layout.

### Requirement: R6 Target size on boards

Every interactive board cell MUST present at least 44×44 dp through size or
`hitSlop`, and `hitSlop` MUST NOT be used where adjacent cells would overlap.

#### Scenario: Board interaction area

- GIVEN any interactive board cell
- WHEN its interaction area is measured
- THEN it is at least 44×44 dp, or the cell is at least 44 dp in one axis with
  non-overlapping slop on the other.

### Requirement: R7 Mechanics untouched

Reducers, generators, scoring, difficulty and persistence MUST NOT change, and
every existing testID MUST remain.

#### Scenario: Behavioural equivalence

- GIVEN the game unit suites before and after the change
- WHEN they run
- THEN they pass unmodified, and the diff touches only presentation files.
