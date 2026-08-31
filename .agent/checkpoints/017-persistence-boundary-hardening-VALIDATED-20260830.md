# Campaign 017 — Persistence Boundary Hardening

**Status:** VALIDATED
**Validation date:** 2026-08-30
**Source state:** owner-authorized working state based on `27c9174`
**Successor:** `018-engagement-temporal-integrity` (ACTIVE)

## Result

Campaign 017 closed the first hardening wave across local persistence,
portability, synchronization, reward identity, and temporal read boundaries.
SQLite remains canonical and no feature breadth was added.

Implemented and tested boundaries include:

- safe integer/non-negative persistence domains and schema v11/v12 guards;
- duplicate completion/reward idempotency and deterministic session/rating/
  ledger/conflict ordering;
- canonical local-profile export and atomic, recoverable replacement import;
- source-aware one-shot reward merge identity and symmetric sync ties;
- explicit user-facing as-of filters for sessions, ratings, XP, ledger, workout,
  achievement, quest, reward, and progression reads;
- future unlock/completion claim rejection and bounded streak/reward inbox reads;
- stale async game-session callback protection and pause-preserving timing;
- Workout V3 exact persisted-instance attribution and reconciliation.

## Validation evidence

| Gate | Result |
|---|---|
| Full Node 22 Jest (`--ci --maxWorkers=2 --silent`) | PASS — 489/493 suites, 6087/6092 tests, 5 snapshots; 4 suites / 5 tests skipped by the existing explicit measurement allowlist |
| Focused real-DB persistence/migration/projection/reward/streak/sync/portability suites | PASS |
| TypeScript | PASS |
| Expo lint | PASS — 0 errors / 0 warnings |
| Repository state, task ownership, OpenSpec | PASS |
| Generated registry, provenance, offline boundary | PASS |
| QA harness self-test | PASS — 51/51 |
| Dependency audit | NOT GREEN — 16 accepted Expo/Metro/Xcode build-toolchain findings, documented in `.agent/DEPENDENCY_AUDIT.md`; no safe in-SDK fix was available |
| Android runtime certification and hierarchy | BLOCKED / NOT VALIDATED — dedicated AVD bounded TCG matrix never reached stable `sys.boot_completed=1`; foreign emulator not adopted |
| Manual TalkBack, SAF/system sheets, physical device, manual iOS UX | NOT VALIDATED / BLOCKED |

The first full test run exposed seven genuine fixture/contract regressions from
the new bounds and schema guards. They were repaired with explicit fixtures and
the second full run passed; no failure was hidden or allowlisted.

## Durable transition

The 017 OpenSpec status, task checklist, governance, state, ownership, current
campaign, execution prompt, known-issues, and validation records were updated
together with activation of 018. Campaign 018 is the sole ACTIVE campaign.
