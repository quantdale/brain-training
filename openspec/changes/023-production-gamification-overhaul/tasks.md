# Tasks — Campaign 023 Production & Gamification Overhaul

## Phase 1 — Tooling & MCP

- [x] 1.1 Add Refero MCP config to gitignored `.kimi-code/local.toml` and user
  opencode config; verify no token is tracked (`git check-ignore`).
- [x] 1.2 Verify live MCP connection: `initialize` + `tools/list` against
  `https://api.refero.design/mcp`; record server identity and tool inventory.
- [ ] 1.3 Fire representative research queries (screens/styles/flows) for the
  named benchmark apps and record findings + reference lock in `audit-map.md`.
- [ ] 1.4 Record the un-installed `refero-design` skill note (server offers an
  install path that requires explicit owner approval).

## Phase 2 — Baseline & functional audit

- [ ] 2.1 Baseline matrix: full Jest suite, `tsc --noEmit`, lint, registry
  check, task-ownership, repo-state validator.
- [ ] 2.2 Audit every registered game module against the common checklist
  (generator, scoring, edge cases, timers, pause/resume, reset/replay,
  tutorial, state desync); record dispositions in `audit-map.md`.
- [ ] 2.3 Repair every confirmed defect with a deterministic regression test.
- [ ] 2.4 Verify reset/replay leaves no timers/listeners/state behind.
- [ ] 2.5 Re-run full matrix after repairs.

## Phase 3 — Gamification & UX overhaul

- [ ] 3.1 Extend `theme/tokens.ts` (elevation, motion, feedback semantics) and
  document the reference lock.
- [ ] 3.2 Implement shared primitives: tactile button, feedback card, progress
  meter; migrate shell/game chrome to them.
- [ ] 3.3 Home: streak counter + daily progress indicator in first viewport.
- [ ] 3.4 Results: reward moment (XP, level progress, records) via shared
  celebration; bounded, skippable, sensory-aware.
- [ ] 3.5 Standardize session header, pause overlay, difficulty selector,
  tutorial frame, and completion modals across all games.
- [ ] 3.6 Success/fail feedback pacing contract applied consistently without
  touching timing-sensitive scoring.
- [ ] 3.7 Re-baseline visual snapshots in a dedicated commit.
- [ ] 3.8 Re-run full matrix; progression/rewards/streaks suites must pass
  unmodified.

## Phase 4 — Production readiness

- [ ] 4.1 Safe-area/responsive audit across small/large phone profiles and
  light/dark, including keyboard-open primary actions.
- [ ] 4.2 Offline fallback audit (cold-start offline game, workout, export).
- [ ] 4.3 Production Android build with zero errors; record artifact
  metadata; standalone start without Metro.
- [ ] 4.4 Runtime certification attempt (autobot/certify) after overhaul; PASS
  per-game evidence or honest NOT VALIDATED.
- [ ] 4.5 Final full matrix + validators at final SHA.
- [ ] 4.6 Durable state update (`STATE.md`, `VALIDATION.md`, campaign packet),
  honest classification summary, commit and push.

## Exit gate

All Phase 1–4 checks complete; zero known Critical/High regressions; matrix
green; build artifact produced and startable; every unexecuted check recorded
as NOT VALIDATED/BLOCKED with reason.
