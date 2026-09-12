# Tasks — Campaign 027: Deep Hardening

## W1 — Correctness repairs

- [x] 1.1 `attention-sustained-vigilance`: hide the stimulus digit the moment a
      trial resolves; regression test on the screen suite.
- [x] 1.2 `flexibility-color-stroop`: remove the unreachable `show-stimulus` /
      `show-flip-cue` actions (or phase-guard any retained dispatch); reducer
      tests updated.
- [x] 1.3 `speed-color-match`: `fastestReactionMs` becomes `number | null`,
      `null` when no correct trial; raw-result version bump; all-timeout test.
- [x] 1.4 `spatial-coordinate-turn`: adaptive sessions escalate per round with
      consistent declared axes and record the reached challenge rating;
      difficulty + screen tests updated.
- [x] 1.5 `language-word-scramble`: remove the dead `roundTimeMs` difficulty
      budget and generatorInfo field with the required generator version bump;
      difficulty/session tests updated.
- [x] 1.6 Broaden: scan sibling games for the same defect classes — one extra
      dead action found and removed (`math-equation-builder puzzle-timeout`,
      duplicating the `tick-timer` expiry branch) with a new expiry regression
      test; `foldV`/`rotate90` are data unions, not actions; every other game
      coalesces non-finite metrics at its session boundary.

## W2 — Performance and startup

- [x] 2.1 Bound the production quest-evaluation path: `syncQuestProgress` now
      materializes at most `SYNC_SESSION_SCAN_LIMIT` (5000) recent samples and
      evaluates longterm `session-count`/`earn-xp` quests from SQL aggregates,
      so lifetime numbers stay exact at any history size; the evaluator falls
      back to the sample for other criteria.
- [x] 2.2 Reuse `syncQuestProgress` samples: it returns the snapshot it
      evaluated and Profile derives its quest rows from the same data — one
      bounded scan + one evaluation per focus instead of two unbounded ones.
- [x] 2.3 Version-gate definition seeding behind a deterministic catalog
      fingerprint (`progressionSeedVersion`); steady-state boots skip ~50
      upserts, a stale fingerprint re-seeds, and an unreadable profile fails
      open to the full path. Schema guards deliberately stay unconditional
      (the Campaign 021 crash-window self-heal relies on them running).
- [x] 2.4 Dev-only perf marks `bootstrap-db-init` and `bootstrap-progression`
      around database init and progression seeding.
- [ ] 2.5 Fuse the backup export canonicalization passes — DEFERRED with
      rationale: export is a deliberate user action (not a hot path), the
      double pass is measured on desktop only (4.9 s + 1.1 s @5k), and fusing
      it risks byte/checksum divergence against `roundtrip.test.ts` without a
      device-visible payoff. Recorded in KNOWN_ISSUES.

## W3 — Reliability tests

- [x] 3.1 Shared session-persistence failure contract: pinned at `<GameResults>`
      (failed persist state renders the error beside intact results, no reward
      card) plus a representative real screen proving one attempt, no retry on
      restart, and the superseded-session guard; the audit premise that
      `use-game-session` owns persistence was corrected (it owns lifecycle).
- [x] 3.2 `math-value-ordering` screen test (intro → interaction → verdict →
      force-win → exactly-once persistence → restart/quit).
- [x] 3.3 Rewards route failure tests (claim throw, claim-all mid-loop throw).
      Found + fixed: both paths were console-only; they now show danger toasts
      and claim-all refreshes after the failure.
- [x] 3.4 Profile streak-item purchase failure / insufficient-funds UI test.
      Found + fixed: generic rejections were console-only (now a toast) and a
      successful apply also fired "No item to apply" (branch fixed).
- [x] 3.5 Storage-unavailable retry-success mounts the app.
- [x] 3.6 Workout advance failure from results now surfaces a danger toast.
      Found + fixed: the hook swallowed the rejection with no error state.
- [x] 3.7 Data-management wipe failure surfaces the engine error.
- [x] 3.8 Export write-failure (ENOSPC/EACCES) propagates and leaves no
      partial artifact; prior backup preserved on overwrite failure.

## W4 — Tooling and CI

- [x] 4.1 `validate-workflows.mjs`: detects unpinned `uses:` and unenforced
      `continue-on-error`; self-tests 44/44 (detection + non-detection).
- [x] 4.2 Dependency-audit gate with explicit self-tested classification
      (26/26) wired into Repository Integrity, BLOCKED on network failure. It
      caught a real runtime-reachable moderate advisory
      (`decode-uri-component` ReDoS via expo-router -> query-string); no
      compatible fix exists, so it is explicitly escalated as
      `runtime-accepted-debt` with an expiry and a tracked follow-up rather
      than silently waived.
- [x] 4.3 All 16 workflow action sites pinned to resolved commit SHAs (original
      tags kept as comments; no unresolved action).

## W5 — Documentation truth

- [x] 5.1 ADR-0005 marked partially superseded; shipping adjacency recorded
      with implementing files (original text preserved).
- [x] 5.2 ADR-0004 version-drift note added (verified revision sequence; body
      untouched).
- [x] 5.3 MASTER_PLAN status, GAME_SDK phase framing, app README routing,
      ANDROID_AUTOMATION AVD default + harness notes, constitution status line,
      GOAL.md directive history all corrected against the code.
- [x] 5.4 KNOWN_ISSUES/BACKLOG reconciled: fixed entries resolved (late-tap,
      vigilance test, HUD 41/42, tab labels, dead actions, Infinity, sync scan,
      xp_awards, provenance allowlist), export deferral and runtime advisory
      recorded.

## W6 — Cleanup

- [x] 6.1 Ten high-confidence dead exports removed (whole-repo re-verified);
      referenced/test-only exports kept with reasons.
- [x] 6.2 Two unreferenced scripts deleted; the stray log proved untracked
      (gitignored) and was left on disk untouched.
- [x] 6.3 Inert provenance allowlist replaced with two precise expiring
      non-semantic entries; `--check` clean.
- [x] 6.4 Stale campaign-003 TODO replaced in the offline boundary test;
      `validate-affected.mjs` duplicate keys removed (15 rules intact).

## W7 — Verification and closure

- [ ] 7.1 Full matrix, lint, all validators green at the closure tree.
- [ ] 7.2 Runtime canaries 8/8 + daily-workout journey PASS on the campaign
      head (or honest BLOCKED with environment evidence).
- [ ] 7.3 Adversarial self-review of the campaign diff; fix findings.
- [ ] 7.4 Durable state, VALIDATION.md, KNOWN_ISSUES.md, BACKLOG.md updated;
      campaign closed with honest classifications.
