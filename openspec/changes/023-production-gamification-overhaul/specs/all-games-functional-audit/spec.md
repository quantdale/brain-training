# All-Games Functional Audit — Delta Spec

## ADDED Requirements

### Requirement: Every registered game is audited against a common checklist

Every game module in the generated registry MUST be inspected against a common
functional checklist: generator determinism/validity, scoring normalization,
edge-case inputs, timer/lifecycle handling, pause/resume integrity, reset and
replay correctness, tutorial gating, and state desynchronization between game
state and persisted results.

#### Scenario: Registry coverage

- GIVEN the generated registry of games
- WHEN the audit completes
- THEN each game carries an audit disposition (clean or fixed with commit
  reference) in the campaign packet.

### Requirement: Discovered defects are repaired with tests

Every confirmed logic bug, crash path, or state-desync defect found by the
audit MUST be repaired and covered by a deterministic regression test in that
game's test surface.

#### Scenario: Fix includes regression coverage

- GIVEN a confirmed defect in a game module
- WHEN the fix lands
- THEN a failing-before/passing-after test exists for it.

### Requirement: Games leak no timers, listeners, or state across reset/replay

No game MUST leave timers, intervals, subscriptions, audio players, or stale
session state behind after completion, abandonment, or replay.

#### Scenario: Replay loop stability

- GIVEN a game played, completed, and restarted repeatedly
- WHEN the host unmounts or restarts the session
- THEN no orphaned timers/listeners remain and a fresh session starts from a
  clean state.

### Requirement: Full automated suite passes, and runtime breadth evidence is honest

The full Jest/typecheck/lint matrix MUST pass. Registry-wide runtime
certification (autobot/certify or equivalent) SHOULD be re-run after gameplay
or shell changes; if the emulator/runtime evidence cannot be produced, the
result MUST be recorded as NOT VALIDATED rather than PASS.

#### Scenario: Runtime evidence classification

- GIVEN the automated suites are green
- WHEN runtime certification is attempted
- THEN it either produces per-game PASS evidence or is recorded as
  NOT VALIDATED with the reason, never silently omitted.
