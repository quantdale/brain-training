# Performance, reliability, and maintenance isolation

## ADDED Requirements

### Requirement: Performance claims are measurement-backed

The product campaign MUST measure supported startup, route, persistence, and
representative data-loading behavior before making performance changes or
claims.

#### Scenario: A candidate hotspot is investigated

- **WHEN** a startup, transition, list, or persistence path is proposed as a
  performance concern
- **THEN** same-runtime measurements or reproducible runtime observations are
  recorded before optimization, and the path’s correctness remains covered.

### Requirement: Reliability changes preserve local state

The product MUST preserve offline bootstrap, SQLite/profile state, and
session/workout identity while repairing demonstrated reliability regressions.

#### Scenario: The app is relaunched after a supported flow

- **WHEN** the app is backgrounded, stopped, or relaunched after a persisted
  profile or representative session state exists
- **THEN** the state remains readable and the app returns to a recoverable
  route without duplicate irreversible writes or destructive loss.

### Requirement: Maintenance is isolated and honest

Dependency and external-CI findings MUST be kept separate from product fixes;
campaign evidence MUST distinguish local validation from external or unavailable
checks.

#### Scenario: A maintenance finding is not safely actionable

- **WHEN** an advisory, patch drift, or CI failure lacks an evidence-backed
  compatible repair in the current scope
- **THEN** it is recorded as external/deferred/NOT VALIDATED and no workflow or
  dependency change is made merely to produce a green label.

