# Audit Map — Campaign 019

| ID | Severity | Area | Required action |
|---|---|---|---|
| L-01 | High | Stale async persistence | Keep current-session identity guards on all 42 game screens. |
| L-02 | High | Pause fairness | Prove active time excludes background/paused intervals and deadlines resume with the remaining budget. |
| L-03 | High | Workout ownership | Require exact persisted instance key, leg index, and game id for advancement. |
| L-04 | Medium | Catalog drift | Repair retired/duplicate/non-finite resume state deterministically and idempotently. |
| L-05 | Medium | Provenance boundary | Reject unsafe indices and malformed route/result tuples before navigation or writes. |

## Evidence separation

Shared-hook and repository tests do not substitute for fresh Android hierarchy,
physical-device timing, TalkBack, or manual iOS UX evidence.
