# Campaign 018 — Engagement Temporal Integrity

**Status:** VALIDATED
**Validation date:** 2026-08-31
**Source state:** successor working state based on `c491c2b`
**Successor:** `019-game-lifecycle-resilience` (ACTIVE)

## Result

Campaign 018 hardened existing quests, streak protection, rewards, and
progression projections without adding product breadth.

Implemented and tested boundaries include:

- strict quest definition, progress identity, progress numeric, completion
  timestamp, and claim-clock validation before SQLite mutation;
- valid real-calendar filtering, deduplication, and deterministic ordering of
  covered streak dates;
- runtime rejection of unknown streak item kinds and malformed milestone
  clocks/streak values;
- future unlock/completion/session exclusion and idempotent direct/inbox claim
  behavior; and
- rollover/catalog-drift consistency coverage across engagement projections.

## Validation evidence

| Gate | Result |
|---|---|
| Focused engagement suites | PASS — 12 suites / 127 tests |
| Focused lifecycle/workout convergence suites | PASS — 8 suites / 68 tests |
| Full Node 22 Jest (`--ci --maxWorkers=2 --silent`) | PASS — 489/493 suites, 6094/6099 tests, 5 snapshots; 4 suites / 5 tests skipped by the explicit measurement allowlist |
| TypeScript | PASS |
| Expo lint | PASS — 0 errors / 0 warnings |
| Repository state, ownership, OpenSpec, registry, provenance, offline boundary | PASS |
| QA harness self-test | PASS — 51/51 |
| Android runtime/manual/physical-device/iOS UX evidence | BLOCKED / NOT VALIDATED — unchanged documented external limitations |

The accepted 16 Expo/Metro/Xcode build-toolchain npm advisories remain
documented and were not force-upgraded. No Critical/High engagement defect is
known.

## Durable transition

The 018 OpenSpec status, task checklist, governance, state, ownership, current
campaign, execution prompt, known-issues, and validation records were updated
together with activation of 019. Campaign 019 is the sole ACTIVE campaign.
