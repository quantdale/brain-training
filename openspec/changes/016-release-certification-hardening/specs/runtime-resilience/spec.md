# Runtime Resilience — Delta Spec

## ADDED Requirements

### Requirement: Workout ownership remains durable and idempotent

Workout completion MUST remain causally attributed and idempotent across duplicate delivery, process death, results reopen, and concurrent same-game active workout instances.

#### Scenario: Duplicate completion is delivered after relaunch
- GIVEN a workout leg was already durably consumed
- AND the process is relaunched without prior React-local references
- WHEN the same completed session is observed again
- THEN no duplicate leg advancement, reward, rating, or progression mutation occurs.

#### Scenario: Two active workouts share the same game route
- GIVEN two active workout instances currently point at the same game
- WHEN one session completes
- THEN only the actual owning workout instance advances.

### Requirement: Persistence failures do not corrupt authoritative state

Database lock, unavailable-storage, and corrupt-state paths MUST fail without silently corrupting progression, rewards, workout state, or backup state.

#### Scenario: Database write is locked
- GIVEN a completed session cannot be persisted because the database is locked
- WHEN the failure path executes
- THEN the app reports/recoverably handles the failure and does not award durable progression for an unpersisted completion.

### Requirement: Data portability preserves integrity and rollback

Backup/import/replace/rollback MUST preserve validation, atomicity, versioning, and integrity metadata under malformed, interrupted, and historical-schema cases.

#### Scenario: Replace import fails midway
- GIVEN a valid existing local dataset
- AND a replacement import fails after mutation begins
- WHEN rollback completes
- THEN the original authoritative dataset remains recoverable and no mixed partial state is accepted.

### Requirement: Lifecycle timing remains fair

Background, pause, resume, and force-timeout behavior MUST NOT grant free response time, study time, duplicate rewards, or rating corruption.

#### Scenario: Timed game backgrounds during response window
- GIVEN a timed challenge is active
- WHEN the app backgrounds and later resumes
- THEN timing follows the game's documented pause policy without granting extra scored response time or replaying rewards.

### Requirement: Production builds enforce the offline QA boundary

Production/native release builds MUST NOT expose development-only mutation hooks, forbidden permissions, accidental network calls, secrets, or telemetry.

#### Scenario: Clean prebuild changes generated permissions
- GIVEN committed Expo configuration defines the production permission boundary
- WHEN native projects are regenerated cleanly
- THEN forbidden microphone/overlay permissions remain absent and production-only builds do not expose QA mutation controls.
