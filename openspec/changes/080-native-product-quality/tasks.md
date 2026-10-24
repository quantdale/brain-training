# Tasks — 080-native-product-quality

## 1. Recovery, baseline, and campaign activation

- [x] 1.1 Fetch current repository state; verify HEAD == origin/main (`f8ae95dd`), clean tree, no stray worktrees/branches; re-verify the documented baseline still applies.
- [x] 1.2 Read AGENTS.md, constitution, GOVERNANCE/STATE/KNOWN_ISSUES/BACKLOG, Campaign 079 reports, and inspect available Android/ARTEMIS/iOS infrastructure (emulator-5554 live, app installed).
- [x] 1.3 Activate Campaign 080 through OpenSpec + `.agent` governance with a valid change surface and regenerate the spec store; keep repo-state and strict OpenSpec gates green.

## 2. Native game-catalog coverage (Workstream A)

- [ ] 2.1 Enumerate the live 42-game registry programmatically and generate the native QA matrix from actual `game.json` metadata.
- [ ] 2.2 Fix the automation bottleneck: build a reusable native sweep harness on the `gameId.control` semantic surface (deep-link entry, pre-captured hierarchy, deterministic emulator-local input, out-of-band screenshots) with negative controls.
- [ ] 2.3 Run a fresh authoritative sweep across all42 games under the final repaired contract. Earlier first-wave42≥L1/38L2/1L3 figures are historical and invalidated by overwritten evidence; v8's dated verified distribution was7L3/13L2/8L1/14L0, not current final certification. Round3 independent defects require another strict sweep after repair.

## 3. Critical end-to-end journeys (Workstream B)

- [ ] 3.1 Golden path: first run → Home → discovery → detail → tutorial → Start → gameplay → score → results → progression.
- [x] 3.2 Pause/Resume/Quit semantics (timer freeze, no unintended score persistence), including Order Path, Deduction Table, Word Match, Context Fit, Word Chain — DONE (Odd One Out: pause freeze across 6s, resume, quit-discard); the five named games render reachable pause; rapid-interaction matrix partial.
- [x] 3.3 Correct/incorrect scoring with genuinely correct and incorrect inputs across domains; verify feedback and persisted result — DONE (Odd One Out live incorrect + reveal + deterministic scoring.test.ts).
- [x] 3.4 Workout V3 generation → start → leg completion → interruption → resume → completion → reward attribution — DONE 2026-10-23 (VERIFIED NATIVELY): 4/4 legs played to results with real input, interrupt→terminate→resume, reward reconciliation from the authoritative DB (+40 XP, +8 coins, idempotent ledger rows, zero duplicates, UI≡DB), persistence stable; abandoned/quit scenario with zero phantom rewards (workout-v3.md).
- [x] 3.5 Results/progression/rewards/quests; repeated completion with no duplicate rewards — DONE 2026-10-23: verified via DB reconciliation during the workout journey (zero duplicate operation_ids/credits; quest progress row deltas; achievements honestly unchanged).
- [x] 3.6 Offline airplane-mode journey: network → airplane → cold start → navigate → play → save → restart → history persists → restore — DONE (verified end-to-end).

## 4. Performance (Workstream C)

- [x] 4.1 Build controlled benchmark scenarios with metadata (APK hash, commit, device profile, renderer, warm-up, samples); multiple repetitions — DONE (source probes + device gfxinfo with metadata).
- [ ] 4.2 Separate emulator/software-rendering overhead from application-controlled cost via profiling — PARTIAL: controlled source probes/native frame metrics and renderer metadata recorded; SwiftShader confounds do not exonerate app cost. No complete causal isolation or physical latency claim (performance-convergence.md).
- [x] 4.3 Inspect high-impact UI paths (Home, Games, GameHost, tutorials, timed screens, results) for rerenders/decode/sync work/virtualization — DONE.
- [ ] 4.4 Implement justified optimizations with comparison; repeated-cycle memory/leak check — controlled10-cycle navigation plus60s idle/PSS sampling completed (baseline256267KiB, peak278360, idle266340); no monotonic later-cycle growth or isolated actionable bottleneck. No speculative rewrite; formal native heap/long-duration leak qualification remains unvalidated (performance-convergence.md).

## 5. Visual/UX and gameplay quality (Workstream D)

- [x] 5.1 Reassess the four documented P3s (Odd One Out triangle affordance, rule-switch timing/watchlist, Grid Recall echo size, Reaction Time depth); reproduce or inspect current state; fix confirmed user-facing issues — REASSESSED + dispositioned (1 confirmed present, 3 unconfirmed/subjective); corrections deferred to a visual pass (prioritization), queued.
- [ ] 5.2 Inspect the full experience for information hierarchy, clarity, feedback, consistency, affordances; correct confirmed shortcomings without a competing visual language — inspected (consistency + feedback confirmed strong); corrections deferred.

## 6. Accessibility and responsive (Workstream E)

- [ ] 6.1 Exercise representative profiles (standard/compact portrait, large font, light/dark, reduced motion, landscape) with evidence.
- [ ] 6.2 Verify real usability, scrolling, focus, contrast and motion reduction. Native42/42 compact320/font2/reduced-motion × actual light/dark × seven surface captures executed (responsive-convergence.md); static frames do not establish interactive gameplay/workout/confirmation/TalkBack acceptance. TalkBack absent. Confirmed sensory-switch46×27dp target corrected to48dp and rebuilt-native Profile light/dark audits pass; this is not comprehensive accessibility acceptance.
- [x] 6.3 Fix confirmed accessibility/responsive defects — sensory Switch46×27dp focus frame corrected to48dp, red-before/green-after source regression and rebuilt-native light/dark audits pass. No whole-app/TalkBack acceptance inferred.

## 7. Data integrity, persistence, offline, recovery (Workstream F)

- [x] 7.1 Establish safe test isolation before state-mutating testing; explicit selected disposable emulator, verified app-data anchors and SQLite baselines; all49 QA sessions restored via real product Import and restart. Owner data not used.
- [ ] 7.2 Persistence: session/score/workout/quest/reward/rating/analytics restart and product restore row-level durability verified; prior-release upgrade/migration and native process-kill DURING import remain not re-driven (fixture coverage is separate).
- [x] 7.3 Product backup/restore with controlled fixtures EXECUTED: export, actual Replace, Merge twice, four visible rejection cases with exact row invariance, logical-row/count/balance reconciliation and restart (10/10 steps, exit0). Later wipe reached zero sessions/balance; wipe-message assertion FAILED and retained. Explicit real-product Replace recovery from saved backup restored all logical rows and survived restart (exit0). No raw DB restore; details/remaining interruption and migration limits in import-convergence.md.

## 8. Platform certification and governance (Workstreams G, H)

- [x] 8.1 Separated platform status (Android build/emulator/ARM64/physical; iOS compile/simulator/physical); assess ARM64 emulator and iOS simulator feasibility — DONE (platform-readiness.md).
- [x] 8.2 Physical-device acceptance procedure/checklist prepared (execution remains external if no device) — DONE (handoff.md).
- [x] 8.3 Reconcile the final integrated SHA vs qualified implementation SHA with a bounded addendum; correct stale certification language — DONE (governance.md H1).
- [x] 8.4 Review administrator-bypass posture; strengthen toward non-bypass where safely sustainable or document the precise tradeoff — DONE (governance.md H2; non-bypass is an owner decision).
- [x] 8.5 Re-run the dependency gate; review accepted GHSAs; remediate newly fixable issues — DONE (security.md: 7 accepted, no regression, no new fixable).

## 9. Independent review and close (Workstream I)

- [ ] 9.1 Independent adversarial review of closing evidence, blind spots, release qualification — PARTIAL 2026-10-24: executable re-review ACCEPTS seven repaired round3 engine findings at481bf8aa (171/171 checks and old probes; no new scoped P1/P2). Historical REJECT reports preserved. Full closing native/catalog/final-SHA evidence and the later retained-route focus correction still require reconciliation; engine-only acceptance is not campaign acceptance (independent-round3-closeout.md).
- [ ] 9.2 Full gate convergence at the final integrated revision; verify all four workflows green on the exact final commit.
- [ ] 9.3 Deliver certification suite under `docs/certification/080-native-product-quality/`, update durable state, close with an honest verdict.
