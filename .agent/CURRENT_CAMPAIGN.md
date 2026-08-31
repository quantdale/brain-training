# Campaign 018 — Engagement Temporal Integrity

**Status:** ACTIVE
**Campaign id:** `018-engagement-temporal-integrity`
**Predecessor:** `017-persistence-boundary-hardening` (VALIDATED)
**Mode:** day
**Change:** `018-engagement-temporal-integrity` (ACTIVE)
**Authorization:** explicit owner directive on 2026-08-30 authorizes whole-codebase hardening followed by autonomous Campaigns 017–020.

## Mission

Harden quest progress inputs, streak calendar state, reward claims, and
progression reconciliation against malformed values, impossible dates,
future-dated events, rollover races, retries, and catalog drift. Preserve the
offline-first product and add no feature breadth.

## Current execution state

Campaign 017 is validated with its persistence, portability, sync, and temporal
read boundary repair set. Campaign 018 is now the sole active campaign. Its
first implementation packet is repository/action input validation followed by
focused real-DB engagement tests and projection reconciliation.

## Exit criteria

- Malformed quest and streak inputs cannot create authoritative state.
- All engagement claims use one validated as-of clock and remain idempotent.
- Home, Rewards, workout, and progression projections converge on bounded
  SQLite truth across rollover and catalog changes.
- Full automated/static validation is rerun and platform/manual limits remain
  honestly classified.
- Durable state, OpenSpec, ownership, and validation records agree before 019
  is activated.

## Scope guard

No game #43, cloud/auth/AI/monetization/social system, signing, store
publication, or unrelated feature expansion is in scope.

## Recovery order

1. `AGENTS.md`
2. `docs/PROJECT_CONSTITUTION.md`
3. `.agent/GOVERNANCE.json`
4. `.agent/STATE.md`
5. `.agent/CURRENT_CAMPAIGN.md`
6. `.agent/KNOWN_ISSUES.md`, `.agent/VALIDATION.md`
7. `openspec/changes/018-engagement-temporal-integrity/EXECUTION.md`
