# Reward Claim Time — Delta Spec

## ADDED Requirements

### Requirement: Claims use one as-of clock

Inbox collection and direct achievement, quest, and streak claims MUST use one
validated safe-integer clock boundary for eligibility and side effects.

#### Scenario: Future completion is delivered

- GIVEN a completion or unlock dated after the claim clock
- WHEN the player collects rewards
- THEN it remains unavailable and no XP, currency, or claim marker is written.

### Requirement: Claim retries are idempotent

Repeated claim attempts MUST not duplicate XP or currency, including when the
first attempt has already committed its claim marker.

#### Scenario: Same reward is claimed twice

- GIVEN a currently eligible reward
- WHEN two sequential claim attempts target it
- THEN exactly one reward grant is represented.
