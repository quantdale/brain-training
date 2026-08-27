# Execution Prompt — Campaign 015: Governance & Depth Convergence

**Status:** ACTIVE
**Change:** `015-governance-depth-convergence` (`change.json` ACTIVE)
**Planned-From:** `c8acadceb46ad6ba3f90b0c4222583a9a2912f49` (audited baseline) → `366a098` (current-head re-audit at `4ac4d45`) → `f66f65c` (014 COMPLETED)
**Planned-At:** 2026-08-27
**Target-Branch:** `main`
**Authorization:** explicit owner directive — `CAMPAIGN015_PROMPT.md` / `EXECUTION.md` 12-hour execution envelope; predecessor 014 COMPLETED at `f66f65c`.
**Predecessor:** `014-experience-depth-replayability` (COMPLETED 2026-08-27 at `f66f65c`)
**12-hour envelope:** Continue through dependency-ready work for the full useful session; do not stop after one wave. If all in-scope implementation finishes early, spend remaining time on deterministic/adversarial validation, warning/flake cleanup tied to changed surfaces, state/docs reconciliation, and exact-SHA CI confirmation. Never use the budget as permission to start an unrelated hardening or breadth campaign. Before termination, write/push a durable checkpoint with start/end SHA, commits, completed/remaining tasks, exact validation results, CI run IDs, device evidence/blockers, and next action.

## Mission

Make the autonomous campaign system mechanically trustworthy, then close the small set of verified depth/replayability gaps that remain after Campaign 014: Rule Grid chained deduction, language content starvation, Transform Match semantic/invariant safety, and measured runtime/accessibility evidence. Do not add games or unrelated features. Make green mean the active plan.

## Activation precondition (now satisfied)

Campaign 015 was PROPOSED until Campaign 014 was durably COMPLETED. 014 is now COMPLETED at `f66f65c` (prior green at `f4aa44c` + precise workout slack at `d645bbb` fixing 2 Jest suites, docs-final DONE, AVD `braintraining-qa36` restored at 6 AVDs and boots to `sys.boot_completed=1` with `-memory 3072 -no-snapshot`, honest NOT VALIDATED for the re-run due to 37.1.x WHPX segfault, considered green per evidence policy). The 014→015 transition is now atomic: `change.json` ACTIVE, `GOVERNANCE.activeCampaign` 015, `CURRENT_CAMPAIGN.md` + `EXECUTION_PROMPT.md` point to 015, `STATE.md` synced, `task-ownership.json` replaced with the 015 packet map, validations run, transition pushed before feature packets. There is exactly one ACTIVE campaign.

## Ordered workstreams

**P0 — Current-head green recovery (already done at `d645bbb`/`6451bfb`):** 2-suite workout routing failures at `366a098` are fixed with precise first-leg-only slack + pre-creation guard (no blanket 10s window), adversarial attribution matrix, full local green, App CI + Repository Integrity should now be green on the repair SHA. If HEAD moved, re-audit the diff/CI first.

**Governance & State Truthfulness (1–4):** OpenSpec binding unconditional, ownership binding to active change, state integrity across GOVERNANCE/STATE/CURRENT_CAMPAIGN/EXECUTION_PROMPT/OpenSpec/ownership, affected-area coverage for current subsystems, root hygiene (delete `'` and `i.startsWith('home')`, narrow validator), legacy 006R reconciliation.

**Game/Content Convergence (5–8):** Rule Grid chained deduction (solver-proven, Hard/Expert dependent chain, difficulty scales inference), Word Chain ≥90 (≥30/tier), Context Fit ≥60/tier (≥180 total) with morphology/POS heuristic and curated ambiguity fixtures, Transform Match final-boundary invariants (source, transform, options, count, distinctness, hidden-source unambiguity, exact option count for every production profile).

**Runtime Evidence (9–10):** Perf probes before/after on changed hot paths with dataset/workload/runtime context, no generic rewrite, wall-clock vs statement-count separate, input→feedback observability for changed timed games; a11y re-audit for changed puzzle surfaces, reuse shared primitives, record Android tree/device evidence honestly, keep manual/iOS as NOT VALIDATED when unavailable.

**Convergence (11):** Re-run repo-state, OpenSpec, ownership, affected-area planning for the complete diff and execute every required light gate; registry/provenance/offline/QA self-test/TS/lint/Jest/web export/Expo Doctor green; dedicated-project Android journeys PASS for changed gameplay + relevant Workout V3 flow (no foreign emulator); no unresolved Critical/High; push final coherent `main` SHA and confirm both GitHub App CI and Repository Integrity green on that exact SHA; mark change lifecycle accurately, write terminal checkpoint, update STATE/CURRENT_CAMPAIGN/KNOWN_ISSUES/VALIDATION, leave clean canonical `main`.

## Test/validation requirements

Layered evidence: (1) validator unit tests for governance/ownership/state, (2) deterministic generator/content validators + many-seed sweeps, (3) targeted app/unit/integration for changed systems, (4) full Jest/typecheck/lint at convergence, (5) registry/provenance/offline/QA self-test, (6) web export + Expo Doctor, (7) dedicated-project AVD journeys for changed gameplay/workout, (8) GitHub App CI + Repository Integrity green on final pushed SHA. Never fake green, never adopt foreign emulator, never hide flakes with blind retries.

## Completion gate

All normative specs in `openspec/changes/015-governance-depth-convergence/specs/**/spec.md` satisfied, every checked task has concrete evidence, active OpenSpec/GOVERNANCE/STATE/EXECUTION_PROMPT/ownership agree, targeted generator/content property suites PASS, required Android changed-surface journeys PASS or honest NOT VALIDATED with blocker, repository validators/typecheck/lint/Jest/registry/provenance/offline/QA self-test/web export/Expo Doctor green as required by impact, final GitHub App CI + Repository Integrity green on pushed final SHA, no unresolved Critical/High, terminal checkpoint + durable state synced, `main` clean. See `tasks.md` and `EXECUTION.md` for the exact task list and 12-hour envelope.

## Recovery order

1. `AGENTS.md`
2. `docs/PROJECT_CONSTITUTION.md`
3. `.agent/GOVERNANCE.json`
4. `.agent/STATE.md`
5. `.agent/checkpoints/014-experience-depth-replayability-COMPLETED.md`
6. `.agent/VALIDATION.md`, `.agent/KNOWN_ISSUES.md`
