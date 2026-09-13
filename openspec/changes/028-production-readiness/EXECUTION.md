# Execution — Campaign 028: Production-Readiness Closure

**Status:** ACTIVE
**Change:** `028-production-readiness`
**Mode:** day (owner may switch to night explicitly)
**Start SHA:** `1733458`
**Predecessor:** `027-deep-hardening` (VALIDATED)
**Authorization:** Owner directive 2026-09-13 — Autonomous Successor Campaign
Directive: explicit authorization to autonomously determine and execute
successor campaigns, quality-improvement passes and production-hardening tasks
until no material executable work remains.

## Mission

Close the residual release-confidence gaps surfaced by four fresh read-only
audits on the 027 closure tree: remaining silent user-action failures,
data-portability robustness and the now-obsolete export deferral, QA-harness
navigation reliability and artifact retention, validator/CI gate integrity,
documentation truth, and dead weight — then re-validate the complete stack
including runtime canaries on the closure head. No new features; no
constitution-deferred systems.

## Read order for a fresh agent

1. `AGENTS.md`, `docs/PROJECT_CONSTITUTION.md`
2. `.agent/GOVERNANCE.json`, `.agent/STATE.md`, `.agent/CURRENT_CAMPAIGN.md`
3. this file → `proposal.md` → `design.md` → `specs/**` → `tasks.md`
4. `audit-map.md` (the evidence behind every item)
5. `.agent/KNOWN_ISSUES.md`, `.agent/VALIDATION.md`

## Work model

- Orchestrator owns shared hotspots: `.agent/**`, `openspec/**`, `scripts/**`,
  `docs/**`, `.github/**`, generated files.
- Disjoint code packets may run in parallel with explicit write ownership
  (W1 app surfaces; W2 data-portability surfaces). Orchestrator performs
  convergence edits and all runtime QA.
- The dedicated QA emulator is `emulator-5560`; `emulator-5554` belongs to
  the user and must not be touched. Host input is never hijacked.
- Retries and skips must be traced/disclosed; never fake a pass.

## Required validation

```bash
cd apps/mobile
npx tsc --noEmit
npx jest --silent --maxWorkers=4
npx expo lint
cd .. && node scripts/validate-repo-state.mjs && node scripts/validate-task-ownership.cjs
node scripts/validate-affected.mjs --list-areas
node scripts/validate-offline.mjs --check && node scripts/validate-offline.mjs --self-test
node scripts/validate-secrets.mjs --check
node scripts/generate-game-registry.mjs --check && node scripts/validate-provenance.mjs --check
node scripts/validate-workflows.mjs && node scripts/validate-workflows.mjs --self-test
node scripts/validate-dependency-audit.mjs && node scripts/validate-dependency-audit.mjs --self-test
node scripts/certification/validate-jest-signal.mjs --self-test
node scripts/qa/autobot.mjs --self-test
npx --yes @fission-ai/openspec@1.6.0 validate --all
```

Runtime (on the campaign head, emulator-5560 + Metro):

```bash
QA_DEVICE=emulator-5560 node scripts/qa/autobot.mjs --mode canaries --pause
QA_DEVICE=emulator-5560 node scripts/qa/autobot.mjs --mode workout
```

## Exit gate

All in-scope tasks complete or explicitly deferred with evidence; matrix,
lint, every validator, OpenSpec and harness self-tests green at the closure
head; runtime canaries and the daily-workout journey PASS at the closure head
(or honestly NOT VALIDATED with reasons); no introduced Critical/High
regression; docs/state truthful; commits pushed.

## Stop conditions

Genuine completion of every executable item, or a genuine external blocker
preserved and durably recorded. Partial progress is committed and pushed as
recoverable checkpoints per Git policy.
