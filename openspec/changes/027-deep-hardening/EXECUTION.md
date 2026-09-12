# Execution — Campaign 027: Deep Hardening

**Status:** ACTIVE
**Change:** `027-deep-hardening`
**Mode:** day (owner may switch to night explicitly)
**Start SHA:** `832971c`
**Predecessor:** `026-visual-identity-rebuild` (VALIDATED, terminal)

## Mission

Execute the owner's master autonomous development directive as a deep
repository-wide hardening campaign: repair the real defects the 2026-09-13
forensic audit found, make unbounded hot paths bounded and observable, close
the highest-value reliability test gaps, harden CI/tooling, make the
documentation true, and remove dead weight — leaving an evidence-backed
repository state and a precise continuation path. Feature development is
frozen for the duration (user-invoked hardening).

## Read order for a fresh agent

1. `AGENTS.md`, `docs/PROJECT_CONSTITUTION.md`
2. `.agent/GOVERNANCE.json`, `.agent/STATE.md`, `.agent/CURRENT_CAMPAIGN.md`
3. this file → `proposal.md` → `design.md` → `specs/**` → `tasks.md`
4. `audit-map.md` (the evidence behind the plan)
5. `.agent/KNOWN_ISSUES.md`, `.agent/VALIDATION.md`

## Work model

- Single orchestrator executes workstreams in priority order; the default
  concurrency ceiling (7) is available for safely partitionable work, but
  shared hotspots (persistence, SDK, registries, package manifests, generated
  files) are orchestrator-owned.
- Versioned game logic edits must bump the corresponding version and pass
  provenance validation.
- One emulator (emulator-5560); host input is never hijacked.

## Required validation

```bash
cd apps/mobile
npx tsc --noEmit
npx jest --silent --maxWorkers=4
npx expo lint
cd .. && node scripts/validate-repo-state.mjs && node scripts/validate-task-ownership.cjs
node scripts/validate-offline.mjs --check && node scripts/validate-secrets.mjs --check
node scripts/generate-game-registry.mjs --check && node scripts/validate-provenance.mjs --check
node scripts/validate-workflows.mjs && node scripts/validate-workflows.mjs --self-test
node scripts/qa/autobot.mjs --self-test
npx --yes @fission-ai/openspec@1.6.0 validate --all
```

Runtime (on the campaign head, when the emulator/Metro are available):

```bash
QA_DEVICE=emulator-5560 node scripts/qa/autobot.mjs --mode canaries --pause
QA_DEVICE=emulator-5560 node scripts/qa/autobot.mjs --mode workout
```

## Exit gate

All in-scope tasks complete or explicitly deferred with evidence; matrix,
lint, validators, canaries and the daily-workout journey green at the closure
head; no introduced Critical/High regression; docs/state truthful; commits
pushed; remaining work precisely recorded.
