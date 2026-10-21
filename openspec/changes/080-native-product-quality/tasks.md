# Tasks — 080-native-product-quality

## 1. Recovery, baseline, and campaign activation

- [x] 1.1 Fetch current repository state; verify HEAD == origin/main (`f8ae95dd`), clean tree, no stray worktrees/branches; re-verify the documented baseline still applies.
- [x] 1.2 Read AGENTS.md, constitution, GOVERNANCE/STATE/KNOWN_ISSUES/BACKLOG, Campaign 079 reports, and inspect available Android/ARTEMIS/iOS infrastructure (emulator-5554 live, app installed).
- [x] 1.3 Activate Campaign 080 through OpenSpec + `.agent` governance with a valid change surface and regenerate the spec store; keep repo-state and strict OpenSpec gates green.

## 2. Native game-catalog coverage (Workstream A)

- [ ] 2.1 Enumerate the live 42-game registry programmatically and generate the native QA matrix from actual `game.json` metadata.
- [ ] 2.2 Fix the automation bottleneck: build a reusable native sweep harness on the `gameId.control` semantic surface (deep-link entry, pre-captured hierarchy, deterministic emulator-local input, out-of-band screenshots) with negative controls.
- [ ] 2.3 Run the sweep across all 42 games; record per-game test level, result, artifact hashes, and remaining gaps in a machine-readable coverage ledger.

## 3. Critical end-to-end journeys (Workstream B)

- [ ] 3.1 Golden path: first run → Home → discovery → detail → tutorial → Start → gameplay → score → results → progression.
- [ ] 3.2 Pause/Resume/Quit semantics (timer freeze, no unintended score persistence), including Order Path, Deduction Table, Word Match, Context Fit, Word Chain.
- [ ] 3.3 Correct/incorrect scoring with genuinely correct and incorrect inputs across domains; verify feedback and persisted result.
- [ ] 3.4 Workout V3 generation → start → leg completion → interruption → resume → completion → reward attribution.
- [ ] 3.5 Results/progression/rewards/quests; repeated completion with no duplicate rewards.
- [ ] 3.6 Offline airplane-mode journey: network → airplane → cold start → navigate → play → save → restart → history persists → restore.

## 4. Performance (Workstream C)

- [ ] 4.1 Build controlled benchmark scenarios with metadata (APK hash, commit, device profile, renderer, warm-up, samples); multiple repetitions.
- [ ] 4.2 Separate emulator/software-rendering overhead from application-controlled cost via profiling.
- [ ] 4.3 Inspect high-impact UI paths (Home, Games, GameHost, tutorials, timed screens, results) for rerenders/decode/sync work/virtualization.
- [ ] 4.4 Implement evidence-based optimizations with before/after comparison; memory/leak check under repeated cycles.

## 5. Visual/UX and gameplay quality (Workstream D)

- [ ] 5.1 Reassess the four documented P3s (Odd One Out triangle affordance, rule-switch timing/watchlist, Grid Recall echo size, Reaction Time depth); reproduce or inspect current state; fix confirmed user-facing issues.
- [ ] 5.2 Inspect the full experience for information hierarchy, clarity, feedback, consistency, affordances; correct confirmed shortcomings without a competing visual language.

## 6. Accessibility and responsive (Workstream E)

- [ ] 6.1 Exercise representative profiles (standard/compact portrait, large font, light/dark, reduced motion, landscape) with evidence.
- [ ] 6.2 Verify real usability (visibility, clipping, scrolling, touch targets, focus, contrast, motion reduction); investigate TalkBack on emulator.
- [ ] 6.3 Fix confirmed accessibility/responsive defects, prioritizing shared controls.

## 7. Data integrity, persistence, offline, recovery (Workstream F)

- [ ] 7.1 Establish safe test isolation before state-mutating testing; preserve owner/emulator data.
- [ ] 7.2 Persistence: session/score/workout/quest/reward/rating/analytics durability, termination/restart, upgrade/install, migration, interruption recovery.
- [ ] 7.3 Backup/restore with controlled fixtures: export/import correctness, malformed rejection, transactional recovery.

## 8. Platform certification and governance (Workstreams G, H)

- [ ] 8.1 Separated platform status (Android build/emulator/ARM64/physical; iOS compile/simulator/physical); assess ARM64 emulator and iOS simulator feasibility.
- [ ] 8.2 Physical-device acceptance procedure/checklist prepared (execution remains external if no device).
- [ ] 8.3 Reconcile the final integrated SHA vs qualified implementation SHA with a bounded addendum; correct stale certification language.
- [ ] 8.4 Review administrator-bypass posture; strengthen toward non-bypass where safely sustainable or document the precise tradeoff.
- [ ] 8.5 Re-run the dependency gate; review accepted GHSAs; remediate newly fixable issues.

## 9. Independent review and close (Workstream I)

- [ ] 9.1 Independent adversarial review of closing evidence, blind spots, and release qualification.
- [ ] 9.2 Full gate convergence at the final integrated revision; verify all four workflows green on the exact final commit.
- [ ] 9.3 Deliver certification suite under `docs/certification/080-native-product-quality/`, update durable state, close with an honest verdict.
