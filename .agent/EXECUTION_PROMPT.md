# Execution Prompt — Campaign 026: Visual Identity Rebuild

**Status:** ACTIVE
**Change:** `026-visual-identity-rebuild`
**Planned-From:** `6f420cc`
**Planned-At:** 2026-09-12
**Target-Branch:** `main`
**Predecessor:** `025-game-board-feedback-consistency` (VALIDATED)

## Mission

Execute the owner's recorded directive (quoted verbatim in
`openspec/changes/026-visual-identity-rebuild/EXECUTION.md`): drastically
change the entire frontend visual identity using Refero-grounded references
until native before/after evidence shows a visibly transformed product — with
gameplay/scoring/persistence and every testID untouched.

## Repository findings that shape the plan

- Campaigns 024/025 shipped a consistent, accessible but visually generic
  "calm blue-indigo on near-white" system; the owner rejects it explicitly and
  permits drastic change.
- The shared layers (`theme/tokens.ts`, `components/ui/**`,
  `components/game-host/**`, `components/screen-shell.tsx`, `app-tabs.tsx`)
  are the high-leverage change surface: restyling them transforms all 42 game
  screens and 16 routes without per-screen rewrites.
- Snapshot/baseline tests (`app/__tests__/visual-baselines.test.tsx`,
  `components/ui/__tests__/**`) and the contrast harness must be updated by
  the orchestrator as part of the identity change — never deleted or weakened.
- The capture tooling (`scripts/qa/ui-capture.mjs`, `a11y-audit.mjs`,
  `autobot.mjs`) already exists and runs against emulator-5560.

## Scope

In: theme tokens + contrast harness; kit rebuild; shell/tabs/screen-shell;
16 routes; game chrome (intro/HUD/results); celebration system; docs.
Out: mechanics/scoring/generators/persistence; new games; new native
dependencies; iOS runtime; store signing; manual TalkBack review.

## Ordered workstreams

1. Identity foundation (orchestrator): tokens, typography, motion, elevation,
   contrast tests, colour sweep.
2. Kit rebuild (orchestrator): every `components/ui/**` primitive + identity
   primitives + kit contract tests.
3. Shell and routes (packets): home/library, progress suite, profile/rewards/
   data, results/workout, tab bar/screen shell.
4. Game chrome + celebration (orchestrator + one packet): intro hero, HUD,
   results, confetti/spark/streak/level-up beats preserve the 025 verdict
   language.
5. Convergence (orchestrator): snapshot updates, full matrix, lint,
   validators, a11y audit, canaries, daily-workout journey.
6. Native evidence: post-redesign captures mirroring the baseline; release
   artifact; docs + durable state.

## Implementation constraints

- Presentation-only diff; existing testIDs survive; no new dependencies.
- Contrast math is real WCAG (AA text, 3:1 large/UI); do not weaken the test.
- Reduced motion and font-scale-2 stay first-class; 44 dp targets stay.
- Shared hotspots are orchestrator-owned; packets report shared needs.

## Acceptance criteria and completion gate

- Every captured surface visibly differs from the baseline in both themes.
- Full Jest matrix, `tsc`, `expo lint`, all validators: green.
- a11y audit: 0 violations both themes; canaries 8/8; daily-workout journey
  PASS.
- Release artifact built from the campaign head (or explicit blocker).
- Durable state + `docs/DESIGN_SYSTEM.md` updated with honest classifications.

## Git requirements

Commit per wave; push `main`; keep it buildable/startable; no force-push;
remove temporary branches/worktrees; never commit secrets.
