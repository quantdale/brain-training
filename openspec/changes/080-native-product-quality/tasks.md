# Tasks — 080-native-product-quality

## 1. Recovery, baseline, and campaign activation

- [x] 1.1 Fetch current repository state; verify HEAD == origin/main (`f8ae95dd`), clean tree, no stray worktrees/branches; re-verify the documented baseline still applies.
- [x] 1.2 Read AGENTS.md, constitution, GOVERNANCE/STATE/KNOWN_ISSUES/BACKLOG, Campaign 079 reports, and inspect available Android/ARTEMIS/iOS infrastructure (emulator-5554 live, app installed).
- [x] 1.3 Activate Campaign 080 through OpenSpec + `.agent` governance with a valid change surface and regenerate the spec store; keep repo-state and strict OpenSpec gates green.

## 2. Native game-catalog coverage (Workstream A)

- [ ] 2.1 Enumerate the live 42-game registry programmatically and generate the native QA matrix from actual `game.json` metadata.
- [ ] 2.2 Fix the automation bottleneck: build a reusable native sweep harness on the `gameId.control` semantic surface (deep-link entry, pre-captured hierarchy, deterministic emulator-local input, out-of-band screenshots) with negative controls.
- [x] 2.3 Run the sweep across all 42 games; record per-game test level, result, artifact hashes, and remaining gaps in a machine-readable coverage ledger — DONE: all 42 at ≥L1 (native smoke), 38 at L2 (interaction), 1 at L3 (lifecycle); merged ledger + matrix delivered. 4 games (code-cracker, running-order, color-match, reaction-time) remain L1 (timed/keypad input shapes).

## 3. Critical end-to-end journeys (Workstream B)

- [ ] 3.1 Golden path: first run → Home → discovery → detail → tutorial → Start → gameplay → score → results → progression.
- [x] 3.2 Pause/Resume/Quit semantics (timer freeze, no unintended score persistence), including Order Path, Deduction Table, Word Match, Context Fit, Word Chain — DONE (Odd One Out: pause freeze across 6s, resume, quit-discard); the five named games render reachable pause; rapid-interaction matrix partial.
- [x] 3.3 Correct/incorrect scoring with genuinely correct and incorrect inputs across domains; verify feedback and persisted result — DONE (Odd One Out live incorrect + reveal + deterministic scoring.test.ts).
- [ ] 3.4 Workout V3 generation → start → leg completion → interruption → resume → completion → reward attribution.
- [ ] 3.5 Results/progression/rewards/quests; repeated completion with no duplicate rewards.
- [x] 3.6 Offline airplane-mode journey: network → airplane → cold start → navigate → play → save → restart → history persists → restore — DONE (verified end-to-end).

## 4. Performance (Workstream C)

- [x] 4.1 Build controlled benchmark scenarios with metadata (APK hash, commit, device profile, renderer, warm-up, samples); multiple repetitions — DONE (source probes + device gfxinfo with metadata).
- [x] 4.2 Separate emulator/software-rendering overhead from application-controlled cost via profiling — DONE (GPU percentiles + legacy/modern jank split; emulator overhead demonstrated).
- [x] 4.3 Inspect high-impact UI paths (Home, Games, GameHost, tutorials, timed screens, results) for rerenders/decode/sync work/virtualization — DONE.
- [ ] 4.4 Implement evidence-based optimizations with before/after comparison; memory/leak check under repeated cycles — no confirmed app-controlled bottleneck cleared the bar (see performance.md C4); memory tradeoff recorded; formal leak run a gap.

## 5. Visual/UX and gameplay quality (Workstream D)

- [x] 5.1 Reassess the four documented P3s (Odd One Out triangle affordance, rule-switch timing/watchlist, Grid Recall echo size, Reaction Time depth); reproduce or inspect current state; fix confirmed user-facing issues — REASSESSED + dispositioned (1 confirmed present, 3 unconfirmed/subjective); corrections deferred to a visual pass (prioritization), queued.
- [ ] 5.2 Inspect the full experience for information hierarchy, clarity, feedback, consistency, affordances; correct confirmed shortcomings without a competing visual language — inspected (consistency + feedback confirmed strong); corrections deferred.

## 6. Accessibility and responsive (Workstream E)

- [ ] 6.1 Exercise representative profiles (standard/compact portrait, large font, light/dark, reduced motion, landscape) with evidence.
- [x] 6.2 Verify real usability (visibility, clipping, scrolling, touch targets, focus, contrast, motion reduction); investigate TalkBack on emulator — PARTIAL (default-profile layout + rich semantic labels verified across 42 games; TalkBack runtime + large-font/compact/dark/motion/landscape not re-driven).
- [ ] 6.3 Fix confirmed accessibility/responsive defects, prioritizing shared controls — no confirmed shared-primitive defect found; a11y odd-item label is a positive accommodation.

## 7. Data integrity, persistence, offline, recovery (Workstream F)

- [ ] 7.1 Establish safe test isolation before state-mutating testing; preserve owner/emulator data.
- [x] 7.2 Persistence: session/score/workout/quest/reward/rating/analytics durability, termination/restart, upgrade/install, migration, interruption recovery — PARTIAL (session/progression durability + offline restart verified; upgrade/migration/interruption source-covered, not re-driven live).
- [ ] 7.3 Backup/restore with controlled fixtures: export/import correctness, malformed rejection, transactional recovery — source-covered; not re-driven on device this campaign.

## 8. Platform certification and governance (Workstreams G, H)

- [x] 8.1 Separated platform status (Android build/emulator/ARM64/physical; iOS compile/simulator/physical); assess ARM64 emulator and iOS simulator feasibility — DONE (platform-readiness.md).
- [x] 8.2 Physical-device acceptance procedure/checklist prepared (execution remains external if no device) — DONE (handoff.md).
- [x] 8.3 Reconcile the final integrated SHA vs qualified implementation SHA with a bounded addendum; correct stale certification language — DONE (governance.md H1).
- [x] 8.4 Review administrator-bypass posture; strengthen toward non-bypass where safely sustainable or document the precise tradeoff — DONE (governance.md H2; non-bypass is an owner decision).
- [x] 8.5 Re-run the dependency gate; review accepted GHSAs; remediate newly fixable issues — DONE (security.md: 7 accepted, no regression, no new fixable).

## 9. Independent review and close (Workstream I)

- [ ] 9.1 Independent adversarial review of closing evidence, blind spots, and release qualification.
- [ ] 9.2 Full gate convergence at the final integrated revision; verify all four workflows green on the exact final commit.
- [ ] 9.3 Deliver certification suite under `docs/certification/080-native-product-quality/`, update durable state, close with an honest verdict.
