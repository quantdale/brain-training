# Audit Map — Campaign 017

Baseline: `27c9174`

| ID | Severity | Area | State | Required evidence |
|---|---|---|---|---|
| P-01 | High | Fractional/negative INTEGER and economy values | IMPLEMENTED | Repository/schema rejection tests and migration matrix |
| P-02 | High | Duplicate session/rating/reward replay | IMPLEMENTED | Real-DB idempotency and unique-key tests |
| P-03 | High | Backup profile scope and replace rollback | IMPLEMENTED | Serialize/apply failure-injection and round-trip tests |
| P-04 | Medium | Future-dated rows affect visible progression | IMPLEMENTED | As-of session/XP/workout/achievement/reward tests |
| P-05 | Medium | Same-time sync conflict asymmetry/cursor rewind | IMPLEMENTED | Sync seam regression tests |
| P-06 | Medium | Read ordering before LIMIT under tied timestamps | IMPLEMENTED | Repository correctness/projection parity tests |
| P-07 | Medium | Current-head full validation | OPEN | Final test/static gate and durable evidence |

## Evidence separation

All-history export/repair behavior must remain distinct from bounded
user-facing snapshots. Local tests must remain distinct from Android runtime,
manual accessibility, SAF/system-sheet, and iOS UX evidence.
