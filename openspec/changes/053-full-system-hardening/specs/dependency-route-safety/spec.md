## Purpose

Keep production dependency advisory handling time-bounded and honest while
constraining app-owned route inputs without overstating their security effect.

## ADDED Requirements

### Requirement: Production advisory disposition
The system SHALL maintain a machine-readable, time-bounded disposition for
every known production-reachable dependency advisory that cannot be safely
remediated in the supported Expo compatibility envelope. The disposition MUST
identify the reachable path, rationale, expiry, and re-evaluation condition.

#### Scenario: Compatible remediation is available
- **WHEN** an officially compatible dependency update removes a production-reachable advisory
- **THEN** the dependency update is evaluated with affected validation and the obsolete accepted-debt disposition is removed or superseded

#### Scenario: Compatible remediation is unavailable
- **WHEN** no safe supported update removes a production-reachable advisory
- **THEN** validation retains only a documented, expiring disposition with its reachable path and re-evaluation condition

### Requirement: Expiring advisory review
The system SHALL fail the dependency-policy validation when a production
advisory disposition expires without a renewed evidence-based decision. It
MUST NOT treat an audit-suggested major downgrade as remediation without
compatibility validation.

#### Scenario: Accepted advisory reaches expiry
- **WHEN** a time-bounded production advisory disposition has expired
- **THEN** dependency-policy validation fails until a compatible remediation or renewed explicit disposition is recorded

### Requirement: App-owned route input envelope
The system SHALL validate app-owned route parameters before using them to
select a game, session, or persistence context. Validation MUST enforce the
current canonical parameter form and bounded size, reject malformed or
oversized values without changing progression or persistence, and provide a
safe navigation outcome.

#### Scenario: Oversized route parameter is supplied
- **WHEN** an app-owned game or session route parameter exceeds its accepted bound
- **THEN** the app does not load or persist a selected target and returns the user to a safe navigation outcome

#### Scenario: Canonical route parameter is supplied
- **WHEN** a route supplies a supported canonical game and session parameter set
- **THEN** the app preserves the existing intended route behavior

### Requirement: Defense-in-depth attribution
The system SHALL document route-envelope validation as defense in depth. It
MUST NOT represent app-local validation as remediation for dependency parsing
that occurs before the application receives route parameters.

#### Scenario: Security evidence is recorded
- **WHEN** route input validation is added or changed
- **THEN** the associated validation record states which boundary it protects and which upstream advisory remains subject to dependency disposition
