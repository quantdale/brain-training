# Campaign 023 — Production & Gamification Overhaul

**Status:** ACTIVE
**Campaign id:** `023-production-gamification-overhaul`
**Predecessor:** `022-release-candidate-certification` (VALIDATED)
**Mode:** day
**Change:** `023-production-gamification-overhaul` (ACTIVE)
**Authorization:** explicit owner goal-mode directive on 2026-09-11 (new scope after Campaign 022 terminal closure).
**Baseline SHA:** `22bf19600dd6ecdd949c0d9615c1d8a43a5542f3`
**Target branch:** `main`

## Mission

Take the certified release candidate to App-Store-submission standard:

1. **Tooling:** configure the Refero MCP design-reference server in
   local/user config (credential never committed) and verify it live.
2. **Audit:** run all unit/integration/E2E tests; audit every registered
   mini-game for broken logic, edge-case crashes, unresponsive controls, and
   state desynchronization; repair every confirmed defect with regression
   tests; prove reset/replay loops leak nothing.
3. **Gamification/UX:** research Duolingo/Brilliant/Headspace patterns via
   Refero; unify tokens, typography, spacing, and shared primitives; add
   reward feedback, streak/daily-progress indicators, bounded completion
   celebrations, and consistent feedback pacing.
4. **Production:** zero-error production build, safe-area/responsive audit,
   offline fallback verification, honest PASS / NOT VALIDATED / BLOCKED
   classification.

## Exit criteria

- Full Jest/typecheck/lint/validator matrix green at final SHA.
- Every game has an audit disposition; every fix has regression coverage.
- Design overhaul implemented with deliberately re-baselined visual snapshots.
- Production artifact built, startable without Metro, metadata recorded.
- Durable state updated; honest classification summary; coherent commits
  pushed to `origin/main`.

## Do not

Do not add games or systems; do not alter authoritative progression
semantics; do not weaken validators/tests; do not commit the Refero token;
do not convert unavailable evidence into PASS.
