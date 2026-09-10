# Execution Entry — Campaign 023 Production & Gamification Overhaul

**Status:** ACTIVE
**Change:** `023-production-gamification-overhaul`
**Baseline:** `22bf19600dd6ecdd949c0d9615c1d8a43a5542f3` (Campaign 022 terminal VALIDATED)
**Target branch:** `main`
**Predecessor:** `022-release-candidate-certification` (VALIDATED)

## Mission

Take the certified release candidate to App-Store-submission standard:
configure and verify the Refero design-reference MCP (credential never
committed); run and repair the full functional test surface across every
mini-game; apply a unified gamified UX overhaul grounded in Refero references
from Duolingo/Brilliant/Headspace; and produce a zero-error production build
with honest safe-area/offline/runtime evidence classification.

## Execution order

1. Refero MCP setup + live verification + benchmark design research.
2. Baseline matrix; per-game functional audit; repairs with regression tests.
3. Design tokens + shared primitives + gamified reward/streak/celebration
   surfaces; deliberate visual re-baseline.
4. Production build, safe-area/offline audit, runtime certification attempt,
   final matrix, durable-state closure.

## Scope guard

No new games or systems; no progression/DB/framework replacement; no
validator/test weakening; no credential commits. Presentation may change;
authoritative semantics may not.

## Stop conditions

Stop for a user decision only on a proven external blocker (missing
credentials/hardware, irreversible publication) or an unresolved product
choice that cannot be inferred from the constitution. Unavailable runtime
evidence is recorded as NOT VALIDATED, never converted to PASS.

## Progress log

- 2026-09-11: Campaign activated from owner goal-mode directive. Refero MCP
  configured in `.kimi-code/local.toml` (gitignored) + user opencode config;
  live `initialize`/`tools/list` verified (`refero_server 0.2.0`).
