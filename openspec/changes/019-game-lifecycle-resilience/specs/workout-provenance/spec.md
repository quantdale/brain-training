# Workout Provenance — Delta Spec

## ADDED Requirements

### Requirement: Workout advancement requires exact ownership

A completed game MUST advance only the persisted workout instance and current
leg represented by its validated provenance tuple.

#### Scenario: Standalone result has matching game id

- GIVEN a standalone session whose game id matches a current workout leg
- WHEN the result is shown
- THEN the workout is not advanced without instance key and leg provenance.

### Requirement: Unsafe provenance is rejected

Route and raw-result provenance MUST reject missing, blank, unsafe, fractional,
negative, or out-of-range identity values.

#### Scenario: Unsafe leg index

- GIVEN a route or result carries a fractional, negative, or unsafe leg index
- WHEN provenance is parsed
- THEN it is rejected and the session is treated as standalone.
