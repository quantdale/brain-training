# Workout Leg Durability

## Purpose

Define that a completed workout leg and the workout's stored position can never
permanently disagree, that ownership of a session is derived from persisted state
rather than from process memory, and that a player can intentionally leave a leg
they do not want to play.

## ADDED Requirements

### Requirement: A completed leg and the stored workout position cannot disagree permanently

When a workout leg is completed and its session is persisted, the workout's
stored position SHALL be advanced to reflect that completion, either in the same
durable operation or through a reconciliation that runs on the next launch.

The system SHALL NOT depend on in-process state that a process termination
discards in order to know that a leg was completed. A workout whose position lags
its completed sessions SHALL be reconciled automatically on the next launch,
without the player having to replay the leg.

#### Scenario: Normal completion

- **GIVEN** an active workout positioned on a leg
- **WHEN** the player completes that leg
- **THEN** the workout's stored position reflects the completion
- **AND** the same completion is not applied twice

#### Scenario: Process terminates between session commit and advance

- **GIVEN** a workout leg whose session has been persisted
- **AND** the application terminates before the workout position is advanced
- **WHEN** the application next launches
- **THEN** the workout's stored position is reconciled to reflect the completed
      leg
- **AND** the player is not asked to replay the leg

#### Scenario: Reconciliation is idempotent

- **GIVEN** a workout whose position has already been reconciled
- **WHEN** reconciliation runs again
- **THEN** the stored position is unchanged
- **AND** no session is counted or rewarded twice

#### Scenario: Reconciliation with no evidence of completion

- **GIVEN** a workout whose position is consistent with its persisted sessions
- **WHEN** reconciliation runs
- **THEN** the stored position is unchanged

### Requirement: Leg ownership is derived from persisted state

Whether a session belongs to a workout leg SHALL be determinable from persisted
state, so that ownership does not depend on state that existed only in the
process that created it. A session whose ownership cannot be determined from
persisted data SHALL NOT be treated as owning a leg.

#### Scenario: Session persisted, process restarted, ownership queried

- **GIVEN** a workout leg whose session was persisted before a process restart
- **WHEN** ownership of that session is queried
- **THEN** ownership is determined from persisted state alone

#### Scenario: Ownership not derivable

- **GIVEN** a session with no persisted evidence of a workout relationship
- **WHEN** ownership is evaluated
- **THEN** the session is not attributed to a workout leg
- **AND** it cannot advance a workout position

### Requirement: A future leg is not launched as if it were the current one

A leg that is not the workout's current leg SHALL NOT be launched in a way that
produces an ownership tuple claiming to be the current leg. A player who
previews or jumps to a later leg SHALL be given behavior consistent with that
choice: either the choice is explicitly recorded as advancing to that leg, or the
launch is clearly a preview that does not claim the current position.

#### Scenario: Launching a later leg

- **GIVEN** a workout positioned on an earlier leg
- **WHEN** the player launches a later leg
- **THEN** the recorded ownership reflects the leg actually being played
- **AND** the earlier leg is not silently marked complete or incomplete by that
      launch

#### Scenario: Progress copy matches the state

- **GIVEN** a workout whose stored position is at leg N
- **WHEN** the workout's progress is displayed
- **THEN** the displayed position and the "Game X of Y" indicator agree with the
      stored position

### Requirement: A player can leave a leg they do not want to play

The workout SHALL provide an explicit, free way to abandon or skip the current
leg. Abandoning a leg SHALL be recorded distinctly from completing it, SHALL NOT
be achievable only through a paid action, and SHALL leave the workout in a state
the player can continue from.

#### Scenario: Skipping a leg

- **GIVEN** an active workout positioned on a leg
- **WHEN** the player chooses to skip that leg
- **THEN** the leg is recorded as skipped rather than completed
- **AND** the workout advances or ends according to the defined skip rule
- **AND** no currency is charged for the skip

#### Scenario: Skip is bounded

- **GIVEN** a player who repeatedly skips legs
- **WHEN** the skip allowance is exhausted
- **THEN** the behavior at that point is defined and communicated to the player

#### Scenario: Skipping does not award leg rewards

- **GIVEN** a leg the player skipped
- **WHEN** the workout is finished
- **THEN** the skipped leg's completion rewards are not granted
- **AND** the rewards for the legs actually completed are granted exactly once

### Requirement: Concurrent writes to a workout position use the same rigor

Every write that changes a workout's stored position SHALL validate the same
preconditions, including the row's current status and the shape and bounds of its
stored leg list. A write that loses a race SHALL not apply.

#### Scenario: Reroll against a completed workout

- **GIVEN** a workout whose status is completed
- **WHEN** a reroll is requested against it
- **THEN** the reroll is rejected
- **AND** the stored workout is unchanged

#### Scenario: Reroll with a degenerate stored list

- **GIVEN** a workout row whose stored leg list is malformed or exceeds its bound
- **WHEN** a write is requested against that row
- **THEN** the write is rejected rather than applied to a malformed row

#### Scenario: Two concurrent advances

- **GIVEN** two advances for the same leg are issued concurrently
- **WHEN** both are processed
- **THEN** at most one is applied
- **AND** the stored position reflects a single advance
