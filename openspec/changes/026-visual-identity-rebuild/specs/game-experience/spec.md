# Game Experience — Delta Spec

## ADDED Requirements

### Requirement: R1 Chrome restyle, mechanics untouched

The game intro hero, session HUD and results MUST be restyled to the new
identity while reducers, generators, scoring, difficulty, session timing,
persistence and every existing testID stay byte-identical in behaviour.

#### Scenario: Mechanics equivalence

- GIVEN the game unit suites before and after the restyle
- WHEN they run
- THEN they pass with only styling expectations updated.

### Requirement: R2 Session HUD

The shared HUD MUST present exit/back at the left, segmented or bar progress
in the centre (with an accessible value) and pause at the right, in a single
row; games without a known total MUST NOT fabricate progress.

#### Scenario: Bounded game

- GIVEN a game with a finite round count
- WHEN a round is in progress
- THEN the HUD shows real position and the accessible progress value.

### Requirement: R3 Verdict language preserved

The Campaign 025 verdict vocabulary (soft fill + verdict border + ✓/✕/⏱ badge
+ verdict in the accessible name; reducer-authoritative; prompt mounted;
wrong pick shown with the correct answer where the mechanic reveals it) MUST
be preserved exactly, re-skinned to the new palette.

#### Scenario: Wrong pick

- GIVEN a wrong pick in any game that reveals the answer
- WHEN the verdict renders
- THEN the wrong pick and the correct answer are distinguishable by fill,
  boundary and glyph together, and the prompt is still visible.

### Requirement: R4 Celebration-first results

Results MUST lead with the outcome celebration (headline + hero metric) and
present metrics as equal columns, with exactly one primary CTA.

#### Scenario: Session results

- GIVEN a completed session
- WHEN results render
- THEN the outcome headline/hero renders before the metric columns and only
  one primary action competes.

### Requirement: R5 Focus board readability

The play surface MUST keep stimulus colours and verdict colours distinguishable
in both themes, and every interactive cell MUST remain >= 44x44 dp.

#### Scenario: Stroop-style conflict

- GIVEN a game whose stimuli are colourful
- WHEN a verdict renders
- THEN verdict fill/boundary/glyph do not rely on the stimulus hue and remain
  legible.
