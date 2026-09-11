# Celebration Moments — Delta Spec

## ADDED Requirements

### Requirement: R1 Celebration system

The app MUST provide code-native celebration moments — spark mark, confetti,
streak day-strip beat and level-up beat — built from Views/transforms with no
new dependency and no image assets.

#### Scenario: Perfect session

- GIVEN a perfect or milestone session
- WHEN results render
- THEN a celebration beat plays (confetti confined to margins / spark burst)
  without covering body text or the primary CTA.

### Requirement: R2 Reduced motion

Every celebration MUST collapse to a static end state under reduced motion.

#### Scenario: Reduced motion

- GIVEN reduced motion is enabled
- WHEN a celebration would play
- THEN the final state renders immediately with no animation.

### Requirement: R3 Streak rhythm

Streak MUST be presented as a day-dot strip (done/today/pending states) plus a
count, never as a plain text row.

#### Scenario: Home streak

- GIVEN an active streak
- WHEN the streak element renders
- THEN a 5–7 day dot strip communicates the weekly rhythm and today's state.

### Requirement: R4 Staging

Celebration MUST be staged as its own beat (after results or as an overlay
moment), never merged into the results CTA row, and MUST NOT block the user.

#### Scenario: Dismissal

- GIVEN a celebration beat is visible
- WHEN the user continues
- THEN the beat dismisses/advances without losing the results context.

### Requirement: R5 Determinism

Confetti/spark placement MUST be deterministic (seeded), so screenshots and
tests are reproducible.

#### Scenario: Repeated render

- GIVEN the same celebration props
- WHEN it renders twice
- THEN piece layout is identical.
