## Purpose

Recover correctness and usability across all 42 registered games through current source and test evidence, reproducible defect repairs, and selective real-device interaction.

## ADDED Requirements

### Requirement: Forty-two game assessment
Every registered game MUST be inventoried and assessed for mechanics/solutions, scoring, input, lifecycle, presentation, and accessibility. Evidence MUST distinguish source/test review from observed runtime states; historical acceptance MUST NOT override a newly discovered defect. The assessment MUST identify covered and unvalidated states.

#### Scenario: Historical game row is marked pass
- **WHEN** its source, current tests, or filed observations expose a plausible defect
- **THEN** the campaign investigates and reproduces the defect instead of adopting the previous aggregate pass as current proof

### Requirement: Reproducible defect closure
Every confirmed defect MUST have a minimized reproduction, isolated root cause, appropriate repair, meaningful regression coverage, affected-game verification, and a sibling/shared-dependency assessment. Critical and High regressions MUST be repaired before further feature expansion.

#### Scenario: Shared timer or input behavior is defective
- **WHEN** a timer expires the wrong round or repeated input consumes unseen prompts
- **THEN** the fix binds timing/input to the correct active state, tests the real caller pattern, and avoids inconsistent per-game workarounds

### Requirement: Fair clear playable games
Rules, tutorials, stimuli, responses, generated puzzles, and expected solutions MUST agree. Deadlines MUST use active monotonic time and freeze across pause. Taps MUST correspond to rendered touch geometry and late/repeated input MUST NOT corrupt state. Boards and choices MUST remain legible and reachable across required layouts. Feedback and performance metrics MUST classify outcomes honestly and display sensible rounded values.

#### Scenario: A player pauses near a deadline
- **WHEN** the player resumes after a long interruption
- **THEN** remaining active time and speed measurements exclude the paused interval and a stale timer or response cannot affect the new round

### Requirement: Versioned integrity-preserving game repairs
Game identities and completed historical sessions MUST be preserved. Changed scoring, generation, or content rules MUST receive appropriate version metadata, and XP/reward/session effects MUST persist exactly once. Core games MUST remain offline and safe QA fixtures MUST remain unavailable in production.

#### Scenario: A completed session is revisited after a repair
- **WHEN** the results screen is reopened or the app restarts
- **THEN** historical metrics retain their original provenance and no session, XP award, workout credit, or currency transaction is duplicated
