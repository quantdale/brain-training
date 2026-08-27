# Campaign 015 — Governance & Depth Convergence

**Status:** ACTIVE — predecessor 014 COMPLETED at `f66f65c`; 015 governance/bootstrap, game/content convergence, runtime evidence, and causal workout attribution are implemented in `60fdadc`. Exact-SHA App CI and Repository Integrity are green; local full-Jest and dedicated-device gates remain open and are recorded honestly below.
**Campaign id:** `015-governance-depth-convergence`
**Predecessor:** `014-experience-depth-replayability` (COMPLETED 2026-08-27 at `f66f65c` — see `.agent/checkpoints/014-experience-depth-replayability-COMPLETED.md`)
**Mode:** day
**Authorization:** explicit owner directive — `CAMPAIGN015_PROMPT.md` / `EXECUTION.md` 12-hour execution envelope; predecessor-close then governance+depth convergence, no game #43, no hardening.
**Change:** `015-governance-depth-convergence` (ACTIVE, `change.json` ACTIVE, `GOVERNANCE.activeCampaign` 015, `STATE` synced, `task-ownership` 015 map, OpenSpec 5 delta specs)

## Mission

Make the autonomous campaign system mechanically trustworthy, then close the verified depth/replayability gaps that remained after Campaign 014: Rule Grid chained deduction, language content starvation, Transform Match semantic/invariant safety, measured runtime/accessibility evidence, and causal workout completion attribution. Do not add games or unrelated features. Make green mean the active plan.

**12-hour envelope:** Continue through dependency-ready work for the full useful session; do not stop after one wave. If all in-scope implementation finishes early, spend remaining time on deterministic/adversarial validation, warning/flake cleanup, state/docs reconciliation, and exact-SHA CI confirmation. Never use the budget as permission to start an unrelated hardening or breadth campaign.

## Workstreams

### Predecessor & Red-Main Recovery (P0, 0)

- **P0 — Current-head green recovery / causal attribution:** Pulled moved head `299a831`, confirmed App CI `33108680781` and Repository Integrity `33108680778` green, and found the old two-suite failures no longer reproduced before editing. Commit `60fdadc` now carries exact `(instanceKey, legIndex, gameId)` provenance from route to session JSON and uses a conditional durable advance; the focused attribution seam is 22 suites / 255 tests green. Exact-SHA App CI `33121115984` and Repository Integrity `33121116078` both passed. Local full Jest still has one resource-sensitive timeout and dedicated Android remains NOT VALIDATED.
- **0 — Predecessor closure:** Already COMPLETED at `f66f65c` (014): AVD `braintraining-qa36` restored at 6 AVDs and boots to `sys.boot_completed=1` in ~30s with `-memory 3072 -no-snapshot`, APK 80M `BUILD SUCCESSFUL` + `adb install` `Success` + `am start` success, docs-final DONE (MASTER_PLAN 013→COMPLETED + new 014 section, PARITY_MATRIX V3/mastery/Spotlight), prior dedicated-AVD green at `f4aa44c` considered exit evidence per honest NOT VALIDATED for the re-run (emulator segfault after ~60-120s, `workout-focus` `IN_PROGRESS` then `device offline`).

### Governance & State Truthfulness (1–4)

1. **Governance binding:** **LANDED** — Make `GOVERNANCE.activeCampaign` ↔ `change.json` ↔ `STATE` ↔ `CURRENT_CAMPAIGN` ↔ `EXECUTION_PROMPT` ↔ `task-ownership` ↔ OpenSpec one-active invariant unconditional; remove 006R special-case.
2. **Ownership binding:** **LANDED** — Replace stale 006R `task-ownership.json` with 015 map using real repo-root paths (`apps/mobile/...`, `scripts/...`, `openspec/...`), require unique IDs, valid deps, acyclic graph, overlap/intersection semantics for protected/generated, and per-packet cheap validation.
3. **State integrity:** **LANDED** — Define authoritative machine-readable campaign fields, detect contradictions across GOVERNANCE/STATE/CURRENT_CAMPAIGN/EXECUTION_PROMPT/OpenSpec/ownership, add regression fixtures for the 014/013 contradiction, extend `validate-affected.mjs` for workout/personalization/mastery/spotlight, sync/data-portability, content/registry/provenance, OpenSpec/governance, keep `IMPACT_MAP.md` in sync.
4. **Hygiene & legacy:** **LANDED** — Delete the two zero-byte root artifacts (`'` and `i.startsWith('home')`), add narrowly-scoped root hygiene validator, add regression test for unexpected zero-byte root, reconcile 006R `change.json`/task lifecycle against intended historical final SHA.

### Game/Content Convergence (5–8)

5. **Rule Grid chained deduction:** **LANDED** — Solver-proven chained deduction; Hard/Expert contain dependent chains; difficulty scales inference depth/interaction, final validation proves uniqueness + minimum depth, and no weakened fallback remains.
6. **Word Chain depth:** **LANDED** — 90 curated chains, 30 per active tier, stable/versioned IDs, strengthened exact-chain/near-duplicate/tier/decoy validation, and deterministic selection coverage.
7. **Context Fit depth:** **LANDED** — 60 items per tier / 180 total, stable/versioned IDs, distinctness/uniqueness/tier/determinism validation, POS heuristic, and curated ambiguity fixtures.
8. **Transform Match invariants:** **LANDED** — All production profiles route through one final validator with exact option counts, hidden-source unambiguity, near-duplicate checks, no symmetry bypass, version bump, and broad many-seed sweeps.

### Runtime Evidence (9–10)

9. **Perf and game-feel:** **LANDED** — Opt-in baselines and runtime context are recorded; statement-count and wall-clock claims remain separate, with deterministic instrumentation for changed timed games.
10. **Accessibility:** **LANDED with explicit platform limits** — Rule Grid and Transform Match semantics/a11y copy/shared primitives were re-audited; available hierarchy evidence is recorded, while current Android rerun, manual sheets, and iOS remain NOT VALIDATED where unavailable.

### Convergence (11)

11. **Exit gate:** **IN PROGRESS** — Static gates, typecheck/lint, web export, Doctor, and exact-SHA CI for `60fdadc` are green; local full Jest still has one classified timeout, dedicated-project Android is blocked by the known AVD failure, and the campaign remains active until those limits are resolved or accepted under a future evidence decision.

## Exit criteria

Campaign 015 is COMPLETED only when its normative OpenSpec requirements and exit gate are validated, the final pushed `main` SHA is green in App CI and Repository Integrity, durable state is mutually consistent, and no unresolved Critical/High regression remains. See `openspec/changes/015-governance-depth-convergence/tasks.md` for the exact task list and `specs/**/spec.md` for the 5 delta specs (campaign-governance, repository-state-integrity, workout-integrity, game-depth-convergence, runtime-evidence). The activation precondition was satisfied when 014 completed at `f66f65c`; 015 is ACTIVE now.

## Authorization & Mode

Day mode, up to 7 coder agents when useful, one emulator (`braintraining-qa36`), restrained expensive build/test concurrency, light risk-based validation after waves, no host-input interference. The orchestrator owns governance/state/OpenSpec/schema/shared-registry/CI convergence.

## Recovery order

1. `AGENTS.md`
2. `docs/PROJECT_CONSTITUTION.md`
3. `.agent/GOVERNANCE.json`
4. `.agent/STATE.md`
5. `.agent/checkpoints/014-experience-depth-replayability-COMPLETED.md`
6. `.agent/VALIDATION.md`, `.agent/KNOWN_ISSUES.md`
