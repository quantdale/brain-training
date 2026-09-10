# Proposal — Campaign 023 Production & Gamification Overhaul

## Decision

Campaign 022 certified the repository-owned release candidate (CONDITIONAL GO)
and established a green automated matrix at `22bf196`. The owner now directs a
new scope: raise the product from "functionally certified" to
"store-submission standard" by combining (a) live design research through the
owner-provided Refero MCP, (b) a gamified UI/UX overhaul unified across all
games and menus, (c) a functional audit of every registered mini-game with
repairs, and (d) production build verification with honest evidence classes.

Campaign 023 executes exactly that directive. It preserves all locked
constitution decisions and treats XP/rating/currency/streak semantics as
invariant contracts rather than redesign material.

## Starting evidence

- Head `22bf19600dd6ecdd949c0d9615c1d8a43a5542f3` == `origin/main`, clean tree.
- `validate-repo-state` PASS at activation; no active campaign.
- Refero MCP `initialize` + `tools/list` verified live on 2026-09-11
  (`refero_server 0.2.0`); credential stored only in gitignored local config.
- Campaign 022 matrix: Jest 6101 pass / 5 skip, tsc, lint, doctor, validators,
  42/42 Android runtime certification.

## In scope

Refero MCP configuration + live verification; design research against
Duolingo/Brilliant/Headspace patterns; unified design-token and component
overhaul (tactile buttons, feedback cards, progress meters, celebration modal,
typography/spacing discipline); gamified reward/streak/daily-progress surfaces
on Home and results; all-games functional audit with regression tests; reliable
reset/replay lifecycle; full production build with zero errors; safe-area/
responsive/offline audit; honest final classification.

## Out of scope

New games; new gameplay systems or modes; cloud sync/auth/backend; social,
monetization, ads, AI, notifications; telemetry; database/architecture
replacement; dependency churn unrelated to readiness; weakening or skipping
existing validators/tests; committing any credential.

## Completion definition

023 is complete when: the Refero connection is proven and research is recorded;
the design system overhaul is implemented across shell and game chrome with
tests updated deliberately; gamified reward/streak/celebration loops function
without changing progression semantics; every registered game carries an audit
disposition with regression coverage for every fix; the full Jest/typecheck/
lint/validator matrix is green; the production build completes with zero errors
and recorded artifact metadata; safe-area/offline audits are recorded; and the
final summary reports honest PASS / NOT VALIDATED / BLOCKED classifications.
