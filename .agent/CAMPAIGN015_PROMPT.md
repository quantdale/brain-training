# Next-Campaign Handoff — Campaign 015: Governance, Workout Integrity & Depth Convergence

**Change:** `015-governance-depth-convergence`  
**Status:** PROPOSED — DO NOT activate while Campaign 014 is ACTIVE.  
**Re-audited from HEAD:** `366a098527876e2c4c7448526bcdebcb686a59c6`  
**Execution envelope:** one autonomous ~12-hour session, bounded by lifecycle/safety gates.

## One-shot agent instruction

Pull canonical `main`. Do not assume it is green. Read, in order:

1. `AGENTS.md` and `docs/PROJECT_CONSTITUTION.md`.
2. `.agent/GOVERNANCE.json`, `.agent/STATE.md`, `.agent/CURRENT_CAMPAIGN.md`, `.agent/KNOWN_ISSUES.md`, `.agent/VALIDATION.md`.
3. `.agent/CAMPAIGN015_AUDIT.md` and `.agent/CAMPAIGN015_REAUDIT_2026-08-27.md`.
4. `openspec/changes/015-governance-depth-convergence/EXECUTION.md`, `proposal.md`, `design.md`, `audit-map.md`, every `specs/**/spec.md`, then `tasks.md`.
5. Current git history/status plus GitHub Actions for the exact pulled SHA.

Then execute the OpenSpec dependency graph autonomously. Do not ask for routine confirmation. Re-read every file before editing it; current code outranks planning prose.

## Mandatory first action — restore green main

At audited HEAD `366a098`, App CI run `33051125658` is red at Jest: 2 failed suites / 2 failed tests. Both failures are caused by the new 10-second workout timestamp grace window. Start with the P0 recovery tasks in `tasks.md`.

Do not paper over the regression by changing expectations to accept stale/equal sessions. Establish a causal workout/session attribution invariant. Prefer durable instance/leg identity carried from launch through persisted session/results. If another design is used, it must prove equivalent safety and must not depend on an arbitrary positive fixed-duration grace window.

After the repair, run the exact targeted suites, full `npm run test:ci`, typecheck/lint, repository/registry/provenance/ownership/offline/QA gates, then push a coherent green repair and verify App CI on that exact SHA.

## Predecessor gate

Campaign 014 remains ACTIVE. Do not implement Campaign 015 feature/depth packets until 014 is honestly COMPLETED. Finish its required dedicated-project AVD Workout V3/focus journey, representative canaries, required perf/game-feel evidence, docs/state reconciliation, and terminal checkpoint. Never borrow a foreign emulator and never convert unavailable device/iOS/manual evidence into PASS.

If a genuine external device blocker persists, keep 015 PROPOSED. You may fix current-head correctness and improve predecessor-safe diagnostics/state, but you may not bypass the lifecycle gate.

## 12-hour autonomous execution contract

Treat this as a ~12-hour execution envelope from agent start. Continue working until the envelope is exhausted, the full campaign is VALIDATED, or a genuine blocking condition leaves no safe in-scope work.

- Use up to the repository's normal coder concurrency only for disjoint write surfaces after ownership is valid.
- Orchestrator owns governance/OpenSpec/state, shared schema/registry/generated outputs, CI convergence, and final integration.
- At every coherent wave: determine affected areas, run cheap/targeted gates, fix Critical/High regressions immediately, update evidence/state, commit, and push.
- If a wave finishes early, advance to the next dependency-ready packet. Do not idle to satisfy the 12-hour request.
- If Campaign 015 itself completes before the envelope, spend remaining useful time on repeated deterministic validation, adversarial cases tied to changed surfaces, flake/warning elimination, documentation reconciliation, and exact-SHA CI confirmation. Do not silently start a new full hardening campaign.
- Preserve user work; no autonomous force-push to `main`.

## Mission after 014 closes

Make the campaign control plane mechanically truthful; replace heuristic workout ownership with a durable correctness invariant; remove root residue; close the verified Rule Grid / Word Chain / Context Fit / Transform Match depth gaps; strengthen risk-based affected-area coverage; and produce measured runtime/accessibility evidence without speculative rewrites.

Do not add games, cloud/auth/social/leaderboards/AI/ads/payments/store work, or unrelated visual redesign.

## Completion standard

Do not call the campaign complete unless all normative OpenSpec requirements are satisfied, all checked tasks carry evidence, no unresolved Critical/High regression remains, dedicated Android evidence is honestly classified, durable state is mutually consistent, and **both App CI and Repository Integrity are green on the exact final pushed SHA**.

Before ending the session for any reason, write a durable checkpoint with: starting SHA, ending SHA, commits, tasks completed/remaining, exact commands/results, CI run IDs/conclusions, device artifacts or blocker evidence, and the next executable action. Push all coherent work.
