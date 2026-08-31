# Campaign 019 — Game Lifecycle Resilience

**Status:** ACTIVE
**Campaign id:** `019-game-lifecycle-resilience`
**Predecessor:** `018-engagement-temporal-integrity` (VALIDATED)
**Mode:** day
**Change:** `019-game-lifecycle-resilience` (ACTIVE)
**Authorization:** explicit owner directive on 2026-08-30 authorizes whole-codebase hardening followed by autonomous Campaigns 017–020.

## Mission

Harden all 42 existing game sessions and Workout V3 ownership against stale
async callbacks, pause/background transitions, malformed provenance, process
relaunch, and catalog drift. No feature breadth is in scope.

## Current execution state

Campaign 018 is validated with strict quest/streak inputs, canonical covered
dates, time-safe claims, and engagement/progression checks. Campaign 019 is the
sole active campaign. Its first audit found and repaired unsafe provenance
indices and non-finite workout resume state, and added a source-level tripwire
over every catalog screen.

## Exit criteria

- Every game persistence callback is guarded by the current session identity.
- Paused/background time cannot change active gameplay deadlines or elapsed
  session time, and timer cleanup is verified.
- Workout advancement requires exact persisted instance/leg/game provenance.
- Catalog drift and corrupt resume state repair deterministically and idempotently.
- Full automated/static validation is rerun and platform/manual limits remain
  honestly classified before 020 is activated.

## Scope guard

No game #43, content expansion, cloud/auth/AI/monetization/social system,
signing, store publication, or unrelated feature expansion is in scope.

## Recovery order

1. `AGENTS.md`
2. `docs/PROJECT_CONSTITUTION.md`
3. `.agent/GOVERNANCE.json`
4. `.agent/STATE.md`
5. `.agent/CURRENT_CAMPAIGN.md`
6. `.agent/KNOWN_ISSUES.md`, `.agent/VALIDATION.md`
7. `openspec/changes/019-game-lifecycle-resilience/EXECUTION.md`
