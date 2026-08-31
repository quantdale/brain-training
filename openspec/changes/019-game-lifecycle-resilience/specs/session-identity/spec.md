# Session Identity — Delta Spec

## ADDED Requirements

### Requirement: Late callbacks cannot mutate a replacement session

Every catalog game persistence callback MUST verify the session identity that
started it before dispatching success/failure state.

#### Scenario: Restart races persistence

- GIVEN session A is persisting while session B starts
- WHEN session A's callback resolves
- THEN it cannot dispatch into session B or change B's result state.

### Requirement: Session IDs are collision-safe

Starting a new session MUST synchronously replace the current identity and
re-arm exactly-once finalization for only that session.

#### Scenario: Two starts in one clock tick

- GIVEN a session is restarted before the persistence callback from the prior
  session resolves
- WHEN the new session begins
- THEN its identity is current, the old identity is stale, and finalization is
  available exactly once for the new session.
