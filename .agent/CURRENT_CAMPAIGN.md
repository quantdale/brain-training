# Campaign 015 — Governance & Depth Convergence

**Status:** ACTIVE — predecessor 014 COMPLETED at `f66f65c` (6451bfb head, prior green at `f4aa44c` + precise workout slack at `d645bbb`, docs-final DONE, AVD restored, honest NOT VALIDATED for re-run due to 37.1.x WHPX segfault, considered green per evidence policy). Activation at this commit per `openspec/changes/015-governance-depth-convergence/EXECUTION.md` Phase 1.
**Campaign id:** `015-governance-depth-convergence`
**Predecessor:** `014-experience-depth-replayability` (COMPLETED 2026-08-27 at `f66f65c` — see `.agent/checkpoints/014-experience-depth-replayability-COMPLETED.md`)
**Mode:** day
**Authorization:** explicit owner directive — `CAMPAIGN015_PROMPT.md` / `EXECUTION.md` 12-hour execution envelope; predecessor-close then governance+depth convergence, no game #43, no hardening.
**Change:** `015-governance-depth-convergence` (ACTIVE, `change.json` ACTIVE, `GOVERNANCE.activeCampaign` 015, `STATE` synced, `task-ownership` 015 map, OpenSpec 5 delta specs)

## Mission

Make the autonomous campaign system mechanically trustworthy, then close the small set of verified depth/replayability gaps that remain after Campaign 014: Rule Grid chained deduction, language content starvation, Transform Match semantic/invariant safety, and measured runtime/accessibility evidence. Do not add games or unrelated features. Make green mean the active plan.

**12-hour envelope:** Continue through dependency-ready work for the full useful session; do not stop after one wave. If all in-scope implementation finishes early, spend remaining time on deterministic/adversarial validation, warning/flake cleanup, state/docs reconciliation, and exact-SHA CI confirmation. Never use the budget as permission to start an unrelated hardening or breadth campaign.

## Workstreams

### Predecessor & Red-Main Recovery (P0, 0)

- **P0 — Current-head green recovery:** Reproduce the 2-suite workout routing failures at `366a098` / `4ac4d45` (`advance.test.ts` historical 500 vs 1000, `workout-v2.test.ts` equal-timestamp 20_000), preserve stale/equal-session rejection, replace the 10-second grace with causal attribution (no positive fixed-duration window as decisive proof), centralize ownership, add adversarial matrix, restore full local green and require App CI + Repository Integrity green on the exact repair SHA (`d645bbb` already does this with precise first-leg-only slack + pre-creation guard, 6451bfb state sync). If HEAD moved, re-audit.
- **0 — Predecessor closure:** Already COMPLETED at `f66f65c` (014): AVD `braintraining-qa36` restored at 6 AVDs and boots to `sys.boot_completed=1` in ~30s with `-memory 3072 -no-snapshot`, APK 80M `BUILD SUCCESSFUL` + `adb install` `Success` + `am start` success, docs-final DONE (MASTER_PLAN 013→COMPLETED + new 014 section, PARITY_MATRIX V3/mastery/Spotlight), prior dedicated-AVD green at `f4aa44c` considered exit evidence per honest NOT VALIDATED for the re-run (emulator segfault after ~60-120s, `workout-focus` `IN_PROGRESS` then `device offline`).

### Governance & State Truthfulness (1–4)

1. **Governance binding:** Make `GOVERNANCE.activeCampaign` ↔ `change.json` ↔ `STATE` ↔ `CURRENT_CAMPAIGN` ↔ `EXECUTION_PROMPT` ↔ `task-ownership` ↔ OpenSpec one-active invariant unconditional; remove 006R special-case.
2. **Ownership binding:** Replace stale 006R `task-ownership.json` with 015 map using real repo-root paths (`apps/mobile/...`, `scripts/...`, `openspec/...`), require unique IDs, valid deps, acyclic graph, overlap/intersection semantics for protected/generated, and per-packet cheap validation.
3. **State integrity:** Define authoritative machine-readable campaign fields, detect contradictions across GOVERNANCE/STATE/CURRENT_CAMPAIGN/EXECUTION_PROMPT/OpenSpec/ownership, add regression fixtures for the 014/013 contradiction, extend `validate-affected.mjs` for workout/personalization/mastery/spotlight, sync/data-portability, content/registry/provenance, OpenSpec/governance, keep `IMPACT_MAP.md` in sync.
4. **Hygiene & legacy:** Delete the two zero-byte root artifacts (`'` and `i.startsWith('home')`), add narrowly-scoped root hygiene validator, add regression test for unexpected zero-byte root, reconcile 006R `change.json`/task lifecycle against intended historical final SHA.

### Game/Content Convergence (5–8)

5. **Rule Grid chained deduction:** Solver-proven chained deduction; Hard/Expert must contain at least one dependent chain; difficulty scales inference depth/interaction, not just size/time; final validation proves uniqueness + minimum depth; no weakened fallback; advance generator/scoring version.
6. **Word Chain depth:** ≥90 curated chains, ≥30 per active tier, stable IDs, declared count/version, validation for exact chaining rule, duplicate/near-duplicate/reordered, tier constraints, decoy diversity, deterministic selection/repetition tests.
7. **Context Fit depth:** ≥60 per tier (≥180 total), stable IDs, declared count/version, validation for answer/distractor distinctness, exactly one accepted answer, deterministic selection, tier structure, morphology/POS compatibility heuristic, curated ambiguity fixtures, content registry/provenance.
8. **Transform Match invariants:** Inventory every production difficulty/profile + transform/option-count; define one final `validateGeneratedRound` contract (source, transform, options, count, distinctness, hidden-source unambiguity, near-duplicate); route main + every fallback through it; remove single-transform symmetry bypass; guarantee exact option count for every production profile; reject hidden-source sets with >1 defensible exact transform; advance generator version; add broad all-profile/many-seed sweeps.

### Runtime Evidence (9–10)

9. **Perf and game-feel:** Run relevant existing opt-in probes before evidence-driven optimization, record dataset/workload/runtime context + fresh baseline artifacts, profile only changed/hot paths, rerun identical probes after any perf change and record before/after, add deterministic input→feedback observability for changed timed games, keep statement-count separate from wall-clock.
10. **Accessibility:** Re-audit changed Rule Grid and Transform Match semantics (labels, roles, selected/disabled, focus order, decorative), verify a11y text does not leak answer, reuse reduced-motion/font-scale/focus/announcement primitives, record Android tree/device evidence where available, keep manual/iOS as NOT VALIDATED when unavailable.

### Convergence (11)

11. **Exit gate:** Re-run repo-state, OpenSpec, ownership, affected-area planning for the complete campaign diff and execute every required light gate; registry/provenance/offline/QA self-test/TS/lint/Jest/web export/Expo Doctor green; dedicated-project Android journeys PASS for changed gameplay + relevant Workout V3 flow (no foreign emulator); no unresolved Critical/High; push final coherent `main` SHA and confirm both GitHub App CI and Repository Integrity green on that exact SHA; mark change lifecycle accurately, write terminal checkpoint, update STATE/CURRENT_CAMPAIGN/KNOWN_ISSUES/VALIDATION, leave clean canonical `main`.

## Exit criteria

Campaign 015 is COMPLETED only when its normative OpenSpec requirements and exit gate are validated, the final pushed `main` SHA is green in App CI and Repository Integrity, durable state is mutually consistent, and no unresolved Critical/High regression remains. See `openspec/changes/015-governance-depth-convergence/tasks.md` for the exact task list and `specs/**/spec.md` for the 5 delta specs (campaign-governance, repository-state-integrity, workout-integrity, game-depth-convergence, runtime-evidence). 015 remains PROPOSED until 014 is COMPLETED — now satisfied at `f66f65c`.

## Authorization & Mode

Day mode, up to 7 coder agents when useful, one emulator (`braintraining-qa36`), restrained expensive build/test concurrency, light risk-based validation after waves, no host-input interference. The orchestrator owns governance/state/OpenSpec/schema/shared-registry/CI convergence.

## Recovery order

1. `AGENTS.md`
2. `docs/PROJECT_CONSTITUTION.md`
3. `.agent/GOVERNANCE.json`
4. `.agent/STATE.md`
5. `.agent/checkpoints/014-experience-depth-replayability-COMPLETED.md`
6. `.agent/VALIDATION.md`, `.agent/KNOWN_ISSUES.md`
