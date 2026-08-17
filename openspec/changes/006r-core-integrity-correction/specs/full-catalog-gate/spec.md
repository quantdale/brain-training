# Full Catalog Exit Gate — Validation Spec

## ADDED Requirements

### Requirement: Entire existing catalog satisfies core contracts
Before 006R can close, all 20 existing registered games MUST satisfy the current Game SDK metadata/provenance/session/tutorial/result contracts. No new game is required or allowed by this change.

### Requirement: Generator/content validation breadth
Every procedural/hybrid game MUST be tested over every named difficulty and a substantial deterministic seed set. Curated packs MUST pass their structural and semantic validators. A failure in one difficulty invalidates the gate.

### Requirement: Session journey consistency
For every game contract (with representative AVD runtime across categories and targeted deep journeys), the system MUST be able to start, pause/background where applicable, complete or QA-force completion, persist exactly one session, and surface the authoritative persisted outcome.

### Requirement: Economy integrity gate
Failure-injection and concurrency tests MUST prove no supported purchase/claim/reroll path yields partial state, duplicate reward, or negative balance.

### Requirement: Workout journey gate
One Android AVD MUST prove a real 4-game Daily Workout, `Next Game` transitions, mid-workout interruption/restart, resume, and final completion with no duplicate rewards.

### Requirement: Storage failure gate
Tests MUST cover unsupported newer schema and canonical DB initialization failure with explicit safe UX.

### Requirement: Final static/CI gate
Repository/OpenSpec validator, ownership validator, provenance validator, registry check, lint, typecheck, full tests, web export, Expo Doctor, and applicable Android smoke MUST be green. Final GitHub App CI and Repository Integrity MUST be green when the services are available.

### Requirement: No fake completion
Any unavailable required validator is `NOT VALIDATED` or `BLOCKED`; it cannot be marked PASS. No Critical/High defect may remain when the change is declared VALIDATED.

### Requirement: Durable closure
Completion MUST update `.agent/STATE.md`, `.agent/VALIDATION.md`, `.agent/KNOWN_ISSUES.md`, relevant parity/docs, and create `.agent/checkpoints/006r-core-integrity-correction-complete.md` with final SHA and evidence.