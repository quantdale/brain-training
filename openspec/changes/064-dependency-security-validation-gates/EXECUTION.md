# Execution — 064-dependency-security-validation-gates

**Entrypoint.** Implement `proposal.md` per `design.md`, satisfying
`specs/validation-security-gates/spec.md`, completing `tasks.md`.

**Authority.** Owner NIGHT-mode directive via
`.agent/CAMPAIGN056_067_OVERNIGHT_AUTONOMOUS_PROGRAM_PROMPT.md`; predecessor
`063-release-candidate-runtime-matrix` (VALIDATED). Ninth of Changes 056–067;
third theme-062-064 release-resilience item.

**Ownership.** Validation scripts and CI workflows are shared hotspots:
the orchestrator owns the specification, the shared-file edits, the CI
wiring, and convergence. Bounded parallel packets, if used, may touch
only their assigned validator file plus that validator's self-test and
must leave `--self-test` green; no packet edits `.agent/IMPACT_MAP.md`,
`package.json`, `jest/setup.js`, or any workflow.

**Gate discipline.** No product source change is expected. If a gate
repair requires touching product source, it stops and re-scopes: the
console-gate work may touch only test files (emitter scoping) and
test utilities. Product behavior changes belong to 065+.
