# Tasks — Campaign 023 Production & Gamification Overhaul

## Phase 1 — Tooling & MCP

- [x] 1.1 Add Refero MCP config to gitignored `.kimi-code/local.toml` and user
  opencode config; verify no token is tracked (`git check-ignore` +
  `validate-secrets` CLEAN over 1868 tracked files).
- [x] 1.2 Verify live MCP connection: `initialize` + `tools/list` against
  `https://api.refero.design/mcp` (`refero_server 0.2.0`); helper committed at
  `scripts/qa/refero.mjs`.
- [x] 1.3 Fire representative research queries (screens/styles) for the named
  benchmark apps and record findings + reference lock in `audit-map.md`.
- [x] 1.4 Record the un-installed `refero-design` skill note (server offers an
  install path that requires explicit owner approval; not installed).

## Phase 2 — Baseline & functional audit

- [x] 2.1 Baseline matrix: Jest 6100 pass / 5 skip, `tsc --noEmit` 0, lint 0,
  repo-state/task-ownership/OpenSpec validators PASS.
- [x] 2.2 Audit every registered game module (7 parallel packets, 42/42
  dispositions in `audit-map.md`).
- [x] 2.3 Repair every confirmed defect with deterministic regression tests
  (68 files, +3348/-134 in `e351804`; +109 tests).
- [x] 2.4 Reset/replay leaks fixed (study/round/response-window refs keyed by
  session id; stale authoritative state cleared in every reducer).
- [x] 2.5 Full matrix after repairs: Jest 6209 pass / 5 skip (493 suites),
  tsc 0, lint 0.

## Phase 3 — Gamification & UX overhaul

- [x] 3.1 Extended `theme/tokens.ts` (semantic soft fills, streak/xp tones,
  `Elevation`, `Motion`) + reference lock recorded.
- [x] 3.2 Shared primitives: tactile `GameButton`, `FeedbackCard`, tone-aware
  `ProgressTrack`; shell/intro/results migrated.
- [x] 3.3 Home: `StreakCard` (flame + trailing 7-day tracker + at-risk) and
  `LevelCard` (level badge + XP meter + coin chip) in first-viewport order.
- [x] 3.4 `GameResults` reward moment: authoritative XP/coins card after
  persistence succeeds, bounded entrance animation, one reward feedback event;
  wired through all 42 screens with a catalog source contract.
- [x] 3.5 Session header/pause/difficulty/tutorial untouched contracts kept;
  game intro now renders as a surface card; results reward card standardized.
- [x] 3.6 Feedback pacing: reward feedback fires only after the authoritative
  write; timing-sensitive scoring untouched (all timing tests green).
- [x] 3.7 Visual snapshots re-baselined deliberately (`visual-baselines` 2
  updated) inside commit `94b5a88`.
- [x] 3.8 Post-overhaul matrix: Jest 6217 pass / 5 skip (494 suites), tsc 0,
  lint 0.

## Phase 4 — Production readiness

- [x] 4.1 Static responsive/safe-area audit (ScreenShell insets + tests,
  breakpoint helpers, keyboard-open reachability fix); release device run on
  the default 1080x2400 profile; runtime `wm size` profile checks are BLOCKED
  by the headless renderer wedging on display resize (recorded honestly).
- [x] 4.2 Offline audit: `validate-offline` CLEAN over 935 files; release APK
  cold start offline + offline game deep-link PASS.
- [x] 4.3 Production Android build: `:app:assembleRelease` BUILD SUCCESSFUL;
  APK 109,309,873 B, SHA-256 `AE1B9F09...`; standalone cold start PASS (no
  Metro); full matrix green at `81e6841`.
- [x] 4.4 Runtime certification: canaries 8/8 PASS; full `--mode certify`
  42/42 games PASS with the aggregate flag false only from one missing pause
  probe (never-idle dump race, disproven as a product defect by a direct
  back-contract pause/resume probe). See `audit-map.md` / `VALIDATION.md`.
- [x] 4.5 Final full matrix + validators at the closure tree: Jest 6219 pass /
  5 skip (495 suites), tsc 0, lint 0; repo-state, task-ownership, registry,
  offline, secrets, provenance, workflows, OpenSpec all PASS.
- [ ] 4.6 Durable state update (`STATE.md`, `VALIDATION.md`, campaign packet),
  honest classification summary, commit and push.

## Exit gate

All Phase 1–4 checks complete; zero known Critical/High regressions; matrix
green; build artifact produced and startable; every unexecuted check recorded
as NOT VALIDATED/BLOCKED with reason.
