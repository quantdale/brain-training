# Autonomous Governance and CI — Delta Spec

## ADDED Requirements

### Requirement: Task ownership is machine-readable
Parallel task packets MUST declare exact/parseable write surfaces, dependencies, shared/orchestrator-owned surfaces, and completion validation.

#### Scenario: Packet declares machine-readable ownership
- GIVEN a parallel task packet before a swarm wave
- WHEN the orchestrator reads its ownership definition
- THEN it declares exact write surfaces, dependencies, shared/orchestrator-owned surfaces, and completion validation in parseable form.

### Requirement: Unsafe parallel ownership is rejected
Before launching a swarm wave, validation MUST reject overlapping coder write surfaces that can cause concurrent edits, coder ownership of orchestrator-only shared files, and direct-edit ownership of generated outputs.

#### Scenario: Overlapping write surfaces rejected
- GIVEN two coder packets with overlapping write surfaces
- WHEN pre-launch validation runs
- THEN the swarm wave is rejected before launch.

### Requirement: Coherent push is locally green
Before a normal coherent push to `main`, required risk-based local checks MUST pass, including typecheck for code changes. A known failing required check may be pushed only as an explicitly documented blocker/recovery checkpoint, not labeled green.

#### Scenario: Failing required check blocks green push
- GIVEN a required local check fails on a normal coherent push
- WHEN the agent attempts to push to `main`
- THEN the push is not labeled green and does not proceed as if checks passed.

### Requirement: CI covers repository semantic contracts
App/Integrity CI MUST include or invoke, as appropriate: repository/OpenSpec state validation, lint, registry generation check, provenance/version drift check, task-ownership check, TypeScript, tests, web export, Expo Doctor, and stable offline-boundary checks.

#### Scenario: CI invokes required checks
- GIVEN a CI run for app/integrity
- WHEN the pipeline executes
- THEN it runs or invokes repository/OpenSpec validation, lint, registry generation check, provenance drift check, task-ownership check, TypeScript, tests, web export, Expo Doctor, and offline-boundary checks.

### Requirement: Cross-subsystem contract tests
The suite MUST include tests that cross real subsystem boundaries: canonical lowercase difficulty -> session completion -> SQLite -> authoritative XP/currency/rating history -> presentation-facing outcome. Unit tests of each part independently are insufficient.

#### Scenario: End-to-end contract traversed
- GIVEN a canonical lowercase difficulty session
- WHEN the full path through session completion, SQLite, authoritative XP/currency/rating history, and the presentation layer is exercised
- THEN the subsystem-spanning outcome is verified rather than isolated unit checks.

### Requirement: Dependency findings are triaged
Dependency audit findings MUST be classified by production reachability/severity. The agent MUST NOT use blind forced upgrades solely to make an audit count disappear.

#### Scenario: Audit findings classified
- GIVEN a dependency audit produces findings
- WHEN the agent triages them
- THEN findings are classified by production reachability/severity and not blindly force-upgraded merely to clear the count.

### Requirement: OpenSpec active-change integrity
When `.agent/GOVERNANCE.json` names an active campaign with an OpenSpec change, repository validation MUST confirm the change directory, proposal, design, tasks, execution entrypoint, and declared normative specs exist.

#### Scenario: Required change artifacts present
- GIVEN GOVERNANCE names an active campaign with an OpenSpec change
- WHEN repository validation runs
- THEN it confirms the change directory, proposal, design, tasks, execution entrypoint, and declared normative specs exist.