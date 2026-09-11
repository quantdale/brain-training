# Micro-interactions — Delta Spec

## ADDED Requirements

### Requirement: R1 Universal press feedback

Every interactive element MUST give immediate press confirmation (scale or fill
change) within one frame, with a selection haptic where the platform supports it
and the sensory setting allows it.

#### Scenario: Pressable sweep

- GIVEN `src/app/**` and `src/components/**` at the campaign's final SHA
- WHEN pressables are enumerated
- THEN none is found without an animated or state-driven pressed style.

### Requirement: R2 Answer feedback choreography

In-game answer feedback MUST follow the campaign's choreography contract:
correct and incorrect outcomes MUST be distinguishable by fill **and** icon or
shape change (never by colour alone); a wrong pick MUST be shown together with
the correct answer; feedback MUST NOT cover the prompt; and feedback MUST derive
from the authoritative round outcome so a tap inside the scheduling gap cannot
present success while the round scores as a timeout.

#### Scenario: Late tap cannot fake success

- GIVEN `attention-odd-one-out`, `attention-visual-search` and `math-fast-math`
- WHEN a tap arrives after the round's deadline has resolved as a timeout
- THEN the feedback presented is the timeout/failure outcome, not success.

#### Scenario: Verdict is multi-channel

- GIVEN any game answer surface
- WHEN a verdict is presented
- THEN fill and an icon/shape both change, and layout is not colour-only.

### Requirement: R3 Numeric transitions

Metrics that change from user action (score, XP, coins, streak, percentages)
MUST animate to the new value, MUST use tabular figures so layout does not
reflow, and MUST jump directly to the final value under reduced motion.

#### Scenario: Counter behaviour

- GIVEN an `AnimatedNumber` bound to a changing value
- WHEN the value changes
- THEN it animates to the final value, and under reduced motion it renders the
  final value immediately.

### Requirement: R4 Entrance choreography

Screen-level entrances MUST stagger content by the motion token step, MUST NOT
delay interaction, and MUST collapse to the final state under reduced motion.

#### Scenario: Reduced-motion entrance

- GIVEN reduced motion is enabled
- WHEN a staggered screen mounts
- THEN all children are present in their final state with no animation.
- AND WHEN another surface computes weekly-activity/streak-day tiles
- THEN the resulting order and totals are unchanged from the pre-campaign behaviour.

### Requirement: R5 Celebration discipline

Confetti or celebration effects MUST be reserved for genuine achievements
(personal best, level-up, streak milestone, perfect score), MUST NOT obscure
text or controls, MUST complete within 1.5 s, MUST NOT block input, and MUST be
gated by the global sensory settings.

#### Scenario: Celebration is earned and bounded

- GIVEN a routine session completion and a personal-best completion
- WHEN each results surface is presented
- THEN the routine completion presents the quiet treatment, the personal best
  presents the celebration once, and no celebration repeats for the same session.

### Requirement: R6 Streak beat

A streak change MUST be presented as its own beat — icon with count, then
"N-day" label, then day strip, then next-milestone line — staged after rather
than merged into the results summary.

#### Scenario: Streak structure

- GIVEN the Home streak surface and the post-session streak moment
- WHEN each is rendered
- THEN both implement the four-block structure.

### Requirement: R7 Sensory gating

Every visual, audio and haptic effect introduced by this campaign MUST honour
the existing global sensory toggles and the reduced-motion preference.

#### Scenario: Settings suppress feedback

- GIVEN each sensory toggle is off
- WHEN the corresponding effect would fire
- THEN the effect is suppressed while the underlying action still completes.
