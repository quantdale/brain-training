# Execution — Campaign 029: ARTEMIS runtime-QA migration

**Status:** VALIDATED
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

## Closure evidence — 2026-09-17

Campaign 029's fresh-session runtime gates completed on the designated
`emulator-5554` through Codex → ARTEMIS MCP:

- Settings Flash: PASS — `9aaa2db9-5743-4bf9-9835-ab5b537fb622`.
- Brain Training Flash: PASS — `e927ade5-2b2d-4e2f-a150-7c316230a85d`.
- Brain Training Pro: PASS by direct trace/step/screenshot inspection —
  `5908e678-4b6d-4abf-8ece-2fcc41b3cc67`.

The Pro run's optional ARTEMIS verifier subchecks were recorded as
`INCONCLUSIVE` because the Muse route rejected their verifier request schemas;
the task itself completed and its direct UI evidence, route log, and screenshots
were inspected. This is not reported as a verifier PASS or as a provider
fallback. The effective route remained Muse Spark 1.3 Contributor XHigh with no
Gemini, Union Alpha, or alternate provider use. The local-only ARTEMIS worker
fix was loaded at `2ef304bbe17aa4fa80de033ead32000a33e74c41`; it was not pushed
upstream.

## Git requirements

Commit coherent progress to `main`, push successful checkpoints to
`origin/main`, never force-push, and leave no temporary repository worktrees or
branches.
