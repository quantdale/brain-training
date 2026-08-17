# Autonomous Governance and CI — Delta Spec

## ADDED Requirements

### Requirement: Task ownership is machine-readable
Parallel task packets MUST declare exact/parseable write surfaces, dependencies, shared/orchestrator-owned surfaces, and completion validation.

### Requirement: Unsafe parallel ownership is rejected
Before launching a swarm wave, validation MUST reject overlapping coder write surfaces that can cause concurrent edits, coder ownership of orchestrator-only shared files, and direct-edit ownership of generated outputs.

### Requirement: Coherent push is locally green
Before a normal coherent push to `main`, required risk-based local checks MUST pass, including typecheck for code changes. A known failing required check may be pushed only as an explicitly documented blocker/recovery checkpoint, not labeled green.

### Requirement: CI covers repository semantic contracts
App/Integrity CI MUST include or invoke, as appropriate: repository/OpenSpec state validation, lint, registry generation check, provenance/version drift check, task-ownership check, TypeScript, tests, web export, Expo Doctor, and stable offline-boundary checks.

### Requirement: Cross-subsystem contract tests
The suite MUST include tests that cross real subsystem boundaries: canonical lowercase difficulty -> session completion -> SQLite -> authoritative XP/currency/rating history -> presentation-facing outcome. Unit tests of each part independently are insufficient.

### Requirement: Dependency findings are triaged
Dependency audit findings MUST be classified by production reachability/severity. The agent MUST NOT use blind forced upgrades solely to make an audit count disappear.

### Requirement: OpenSpec active-change integrity
When `.agent/GOVERNANCE.json` names an active campaign with an OpenSpec change, repository validation MUST confirm the change directory, proposal, design, tasks, execution entrypoint, and declared normative specs exist.