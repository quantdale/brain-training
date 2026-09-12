# Tasks — Campaign 027: Deep Hardening

## W1 — Correctness repairs

- [ ] 1.1 `attention-sustained-vigilance`: hide the stimulus digit the moment a
      trial resolves; regression test on the screen suite.
- [ ] 1.2 `flexibility-color-stroop`: remove the unreachable `show-stimulus` /
      `show-flip-cue` actions (or phase-guard any retained dispatch); reducer
      tests updated.
- [ ] 1.3 `speed-color-match`: `fastestReactionMs` becomes `number | null`,
      `null` when no correct trial; raw-result version bump; all-timeout test.
- [ ] 1.4 `spatial-coordinate-turn`: adaptive sessions escalate per round with
      consistent declared axes and record the reached challenge rating;
      difficulty + screen tests updated.
- [ ] 1.5 `language-word-scramble`: remove the dead `roundTimeMs` difficulty
      budget and generatorInfo field with the required generator version bump;
      difficulty/session tests updated.
- [ ] 1.6 Broaden: scan sibling games for the same defect classes
      (post-resolution stimulus visibility, dead actions, Infinity metrics,
      dead difficulty fields) and record findings.

## W2 — Performance and startup

- [ ] 2.1 Bound the production quest-evaluation path (no unbounded history
      scan on Profile focus); documented cap/window with identical quest
      values pinned by the progression suites.
- [ ] 2.2 Reuse `syncQuestProgress` samples for the Profile lightweight read
      (no second full scan per focus).
- [ ] 2.3 Version-gate definition seeding and schema-guard DDL on steady-state
      boots; bootstrap test proves the skip and the fail-closed first run.
- [ ] 2.4 Add dev-only perf marks around DB init / seeding / first Progress
      load so `progress-snapshot-load` latency is attributable.
- [ ] 2.5 Fuse the backup export canonicalization passes if envelope bytes and
      checksum stay identical; otherwise record why not.

## W3 — Reliability tests

- [ ] 3.1 Shared session-persistence failure contract (screen or host): failed
      save surfaces, results intact, no double-write.
- [ ] 3.2 `math-value-ordering` screen test (interaction + force-win +
      persisted exactly-once + navigation).
- [ ] 3.3 Rewards route failure tests (claim-all partial fault, cosmetic
      purchase throw).
- [ ] 3.4 Profile streak-item purchase failure / insufficient-funds UI test.
- [ ] 3.5 Storage-unavailable retry-success mounts the app.
- [ ] 3.6 Workout advance failure from results surfaces a user-visible error.
- [ ] 3.7 Data-management wipe failure surfaces the engine error.
- [ ] 3.8 Export write-failure (ENOSPC/EACCES-style rejection) is handled.

## W4 — Tooling and CI

- [ ] 4.1 `validate-workflows.mjs`: detect unpinned `uses:` and unenforced
      `continue-on-error`; self-tests prove detection and non-detection.
- [ ] 4.2 Dependency-audit gate with explicit self-tested classification;
      wired into Repository Integrity, BLOCKED on network failure.
- [ ] 4.3 Pin workflow actions to SHAs (or record the deferral with rationale)
      keeping the original tags as comments.

## W5 — Documentation truth

- [ ] 5.1 ADR-0005 superseded note (adjacency shipped).
- [ ] 5.2 ADR-0004 version-lift annotation.
- [ ] 5.3 MASTER_PLAN status, GAME_SDK phase framing, app README routing,
      ANDROID_AUTOMATION AVD default, constitution status line, GOAL.md
      directive history.
- [ ] 5.4 KNOWN_ISSUES/BACKLOG: fix stale and misclassified entries
      (late-tap, vigilance test, HUD progress, tab labels, xp_awards, sync cap
      wording, colour-stroop dead actions after repair).

## W6 — Cleanup

- [ ] 6.1 Remove high-confidence dead exports (whole-repo scan).
- [ ] 6.2 Remove unreferenced scripts and the stray tracked log.
- [ ] 6.3 Regenerate/empty the inert provenance allowlist; `--check` stays
      clean.
- [ ] 6.4 Remove the stale campaign-003 TODO in the offline boundary test.

## W7 — Verification and closure

- [ ] 7.1 Full matrix, lint, all validators green at the closure tree.
- [ ] 7.2 Runtime canaries 8/8 + daily-workout journey PASS on the campaign
      head (or honest BLOCKED with environment evidence).
- [ ] 7.3 Adversarial self-review of the campaign diff; fix findings.
- [ ] 7.4 Durable state, VALIDATION.md, KNOWN_ISSUES.md, BACKLOG.md updated;
      campaign closed with honest classifications.
