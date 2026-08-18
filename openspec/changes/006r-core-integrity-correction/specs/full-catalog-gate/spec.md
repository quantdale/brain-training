# Full Catalog Exit Gate — Validation Spec

## ADDED Requirements

### Requirement: Entire existing catalog satisfies core contracts
Before 006R can close, all 20 existing registered games MUST satisfy the current Game SDK metadata/provenance/session/tutorial/result contracts. No new game is required or allowed by this change.

#### Scenario: All 20 games pass SDK contracts
- GIVEN the 20 existing registered games
- WHEN the catalog contract gate runs before 006R closes
- THEN every game satisfies the current SDK metadata/provenance/session/tutorial/result contracts.

### Requirement: Generator/content validation breadth
Every procedural/hybrid game MUST be tested over every named difficulty and a substantial deterministic seed set. Curated packs MUST pass their structural and semantic validators. A failure in one difficulty invalidates the gate.

#### Scenario: One difficulty failure invalidates gate
- GIVEN a procedural game tested across all difficulties and seeds
- WHEN one difficulty fails its checks
- THEN the gate is invalidated rather than passing on the others.

### Requirement: Session journey consistency
For every game contract (with representative AVD runtime across categories and targeted deep journeys), the system MUST be able to start, pause/background where applicable, complete or QA-force completion, persist exactly one session, and surface the authoritative persisted outcome.

#### Scenario: Exactly one persisted session per journey
- GIVEN a game contract exercised on representative AVD runtime
- WHEN the journey starts, pauses/backgrounds, and QA-force completes
- THEN exactly one session persists and the authoritative outcome is surfaced.

### Requirement: Economy integrity gate
Failure-injection and concurrency tests MUST prove no supported purchase/claim/reroll path yields partial state, duplicate reward, or negative balance.

#### Scenario: No negative balance under concurrency
- GIVEN failure-injection and concurrency tests across purchase/claim/reroll paths
- WHEN they execute
- THEN no path yields partial state, duplicate reward, or negative balance.

### Requirement: Workout journey gate
One Android AVD MUST prove a real 4-game Daily Workout, `Next Game` transitions, mid-workout interruption/restart, resume, and final completion with no duplicate rewards.

#### Scenario: Real AVD 4-game workout
- GIVEN one Android AVD
- WHEN a real Daily Workout runs through 4 games with interruption/restart and resume
- THEN it completes with `Next Game` transitions and no duplicate rewards.

### Requirement: Storage failure gate
Tests MUST cover unsupported newer schema and canonical DB initialization failure with explicit safe UX.

#### Scenario: Unsupported schema shows safe UX
- GIVEN tests for unsupported newer schema and DB init failure
- WHEN those conditions occur
- THEN the app presents explicit safe UX.

### Requirement: Final static/CI gate
Repository/OpenSpec validator, ownership validator, provenance validator, registry check, lint, typecheck, full tests, web export, Expo Doctor, and applicable Android smoke MUST be green. Final GitHub App CI and Repository Integrity MUST be green when the services are available.

#### Scenario: All static checks green before close
- GIVEN the final static/CI gate
- WHEN all validators, lint, typecheck, tests, web export, Expo Doctor, and Android smoke run
- THEN they are green before 006R closes.

### Requirement: No fake completion
Any unavailable required validator MUST be `NOT VALIDATED` or `BLOCKED`; it MUST NOT be marked PASS. No Critical/High defect may remain when the change is declared VALIDATED.

#### Scenario: Unavailable validator not marked PASS
- GIVEN a required validator that is unavailable
- WHEN the change status is assessed
- THEN it is recorded as `NOT VALIDATED` or `BLOCKED` and not marked PASS, and no Critical/High defect remains at VALIDATED.

### Requirement: Durable closure
Completion MUST update `.agent/STATE.md`, `.agent/VALIDATION.md`, `.agent/KNOWN_ISSUES.md`, relevant parity/docs, and create `.agent/checkpoints/006r-core-integrity-correction-complete.md` with final SHA and evidence.

#### Scenario: Closure artifacts written
- GIVEN 006R reaches validated completion
- WHEN closure runs
- THEN STATE.md, VALIDATION.md, KNOWN_ISSUES.md, relevant parity/docs are updated and the checkpoint file with final SHA and evidence is created.