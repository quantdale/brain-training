# Execution — Campaign 029: ARTEMIS runtime-QA migration

**Status:** ACTIVE
**Change:** `029-artemis-runtime-qa-migration`
**Mode:** day
**Start SHA:** `13c0e5d`
**Predecessor:** `028-production-readiness` (VALIDATED)
**Authorization:** Owner-supplied migration directive on 2026-09-16.

## Mission

Replace the repository's custom Android Autobot/device-driving QA with Google
ARTEMIS as the external Codex Android runtime, while keeping the app's
deterministic observability contract and the repository buildable, secure, and
recoverable.

## Read order

1. `AGENTS.md`, `docs/PROJECT_CONSTITUTION.md`
2. `.agent/GOVERNANCE.json`, `.agent/STATE.md`, `.agent/CURRENT_CAMPAIGN.md`
3. this file → `proposal.md` → `design.md` → `specs/**` → `tasks.md`
4. `audit-map.md`
5. `.agent/KNOWN_ISSUES.md`, `.agent/VALIDATION.md`
6. `docs/ARTEMIS_ANDROID_QA.md` and `scripts/qa/README.md`

## Work model

- The orchestrator owns `.agent/**`, `openspec/**`, `scripts/**`, `docs/**`,
  `.github/**`, Codex MCP convergence, and all runtime QA.
- The external checkout is exactly `D:\Tools\artemis`; never copy its source
  or traces into the product repository.
- Use one dedicated emulator and one controller. No host input or foreground
  hijacking is allowed.
- Credentials stay external and are never printed. Do not use `mcp --install all`.
- External provider failures are evidence classifications, not reasons to fake
  a green task or to retry blindly.

## Required validation

```bash
node scripts/qa/validate-runtime-qa-contract.mjs
node scripts/validate-repo-state.mjs
node scripts/validate-task-ownership.cjs
node scripts/validate-affected.mjs --check-sync
cd apps/mobile && npm run typecheck && npm run test:ci && npm run lint
```

Also run the repository validators and OpenSpec validation that are relevant to
the changed docs/scripts, then build/install the Android debug app. ARTEMIS
doctor, helper, Flash, Pro, task management, and trace inspection are run from
the external checkout and recorded without secrets.

## Exit gate

The migration can close only when the repository boundary is clean, current
docs/state are truthful, deterministic checks and the app build are healthy,
MCP is merged without collateral configuration changes, and live tasks are
complete or explicitly `BLOCKED`/`NOT VALIDATED` with durable evidence. A live
provider quota block may keep Brain Flash/Pro open; it must be the documented
single external blocker and must not be relabeled as a product result.

## Git requirements

Commit coherent progress to `main`, push successful checkpoints to
`origin/main`, never force-push, and leave no temporary repository worktrees or
branches.
