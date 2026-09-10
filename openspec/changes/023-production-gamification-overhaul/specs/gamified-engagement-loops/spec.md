# Gamified Engagement Loops — Delta Spec

## ADDED Requirements

### Requirement: Reward feedback on every completed session

Every completed game session MUST surface a clear reward moment: XP earned,
level progress, and any new personal records, using the shared celebration
primitive — while preserving the existing authoritative XP/rating/currency
rules and exactly-once persistence.

#### Scenario: Session completion reward

- GIVEN a legitimately completed session
- WHEN the results surface opens
- THEN XP gained, level progress, and records are visible, and celebration
  plays once without double-paying any progression currency.

### Requirement: Streak and daily progress are always visible on Home

Home MUST show the current streak state and today's workout progress in the
first viewport, with freeze/recovery affordances discoverable, and the display
MUST derive from the authoritative streak/progression records.

#### Scenario: Streak rendering from authoritative state

- GIVEN a reconstructed streak state from activity history
- WHEN Home renders
- THEN the streak counter and daily progress match the authoritative records
  (including post-miss recovery states) and link to the relevant detail.

### Requirement: Level-completion celebrations are bounded and skippable

Level-ups, badge/achievement unlocks, and workout completion MUST trigger a
bounded celebration (animation/confetti/modal) that is skippable, respects
reduced-motion and sensory settings, and never blocks input longer than its
declared duration.

#### Scenario: Celebration respects sensory settings

- GIVEN sound/haptics/motion disabled in settings
- WHEN a level-up or unlock occurs
- THEN the celebration renders without the disabled channels and remains
  dismissible.

### Requirement: Success/fail feedback pacing is consistent

Correct/incorrect answer feedback across all games MUST use a consistent,
short, non-blocking pacing contract (visual state plus optional SFX/haptics)
that does not corrupt timing-sensitive scoring.

#### Scenario: Timing-sensitive game fairness

- GIVEN a timing-sensitive game (reaction/tap-speed)
- WHEN feedback plays on answer
- THEN scoring uses monotonic timing unaffected by feedback animation duration.

### Requirement: Regression safety for progression systems

The overhaul MUST NOT change XP/currency/streak/achievement semantics or
persistence contracts; all existing progression, rewards, streaks, quests, and
achievement tests MUST continue to pass unmodified.

#### Scenario: Progression suites untouched

- GIVEN the existing progression/rewards/streaks/quests/achievements suites
- WHEN the overhaul lands
- THEN those suites pass without weakening assertions.
