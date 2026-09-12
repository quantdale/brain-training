# Correctness Repairs — Delta Spec

## ADDED Requirements

### Requirement: R1 Resolved trials hide the stimulus

A game that shows a timed stimulus MUST hide it the instant the trial
resolves (tap, miss or timeout), leaving the verdict treatment visible.

#### Scenario: Vigilance GO resolves

- GIVEN `attention-sustained-vigilance` with the digit visible
- WHEN an in-window GO tap resolves the trial
- THEN the stimulus digit is no longer rendered while the verdict badge stays.

### Requirement: R2 No unreachable reducer actions

Game reducers MUST NOT expose actions that no production path dispatches, and
every rule-changing action MUST be phase-guarded.

#### Scenario: Color Stroop rule change

- GIVEN the current `flexibility-color-stroop` flow
- WHEN the reducer is searched for `show-stimulus` / `show-flip-cue`
- THEN neither exists, and the live `next-trial` flow reproduces the rule
  change at the designed boundary.

### Requirement: R3 Metrics never serialize non-finite values

A raw result field declared `number` MUST NOT contain `Infinity` or `NaN`;
absence of a metric is `null` and the declared type says so.

#### Scenario: All-timeout speed session

- GIVEN a `speed-color-match` session with zero correct taps
- WHEN its raw result is persisted
- THEN `fastestReactionMs` is `null` (never `Infinity`), the rating metric
  extraction still yields the documented fallback, and stored legacy rows
  keep their existing coalescing behavior.

### Requirement: R4 Adaptive difficulty escalates and is recorded

A game that declares adaptive difficulty axes MUST apply them per round and
record the reached challenge, with internally consistent axis bounds.

#### Scenario: Adaptive coordinate turn

- GIVEN `spatial-coordinate-turn` in adaptive mode
- WHEN the player clears rounds successfully
- THEN subsequent rounds use escalated parameters and the persisted challenge
  rating reflects the reached level rather than the session-start minimum.

### Requirement: R5 Versioned provenance matches shipped logic

Difficulty/session fields that no longer affect behavior MUST NOT ship in
versioned provenance, or MUST be explicitly documented as deprecated without
silently reinterpreting stored results.

#### Scenario: Word scramble budget

- GIVEN the untimed `language-word-scramble` design
- WHEN difficulty parameters and session provenance are inspected
- THEN no unused round-time budget is carried, and the required generator
  version bump is recorded so old results keep their historical version.
