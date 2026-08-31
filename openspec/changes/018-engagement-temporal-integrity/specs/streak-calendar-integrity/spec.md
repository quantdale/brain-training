# Streak Calendar Integrity — Delta Spec

## ADDED Requirements

### Requirement: Covered dates are real and deterministic

Streak covered-date reads and writes MUST accept only valid local calendar
dates, remove duplicates, and serialize the resulting set deterministically.

#### Scenario: Impossible legacy date

- GIVEN settings containing `2026-02-30` and valid covered dates
- WHEN the streak is reconstructed
- THEN the impossible date contributes no activity and valid dates remain.

### Requirement: Protection actions validate their clock and item kind

Streak actions MUST reject invalid clocks and unknown item kinds before they
consume inventory or write settings.

#### Scenario: Unknown protection item

- GIVEN a runtime caller passes an unrecognized item kind
- WHEN it attempts to apply an item
- THEN no inventory or covered-date state changes.
