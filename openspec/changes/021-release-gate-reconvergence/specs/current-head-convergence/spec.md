# Current-Head Convergence — Delta Spec

## ADDED Requirements

### Requirement: Terminal status requires current-head green evidence

The repository MUST NOT declare a terminal/VALIDATED state unless, on the
exact declared head, every repository-owned required workflow has been
observed completed successfully and the full local validation matrix has been
re-run. Historical green on an ancestor SHA is not current-head evidence.

#### Scenario: Red required workflow at head

- GIVEN any repository-owned required workflow is red on the current head
- WHEN durable state is written
- THEN the repository is recorded as executable (active campaign or explicit
  blocker), never terminal/VALIDATED.

#### Scenario: Convergence claim

- GIVEN a campaign claims convergence
- WHEN its closure evidence is recorded
- THEN each PASS cites the SHA and, for CI claims, the workflow run id where
  the result was observed.

### Requirement: Evidence classifications stay honest

Unavailable or unexecuted validation MUST be recorded as NOT VALIDATED or
BLOCKED with its constraint, never converted to PASS, and never downgraded
into an allowlisted skip.

#### Scenario: Platform evidence unavailable

- GIVEN physical-device, TalkBack, SAF system-sheet, or iOS runtime evidence
  cannot be produced in the environment
- WHEN the campaign closes
- THEN those items remain NOT VALIDATED/DEFERRED in durable state.
