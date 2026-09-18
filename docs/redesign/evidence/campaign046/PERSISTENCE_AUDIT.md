# Campaign 046 SQLite Persistence Audit

**Artifact:** `D:\Temp\campaign046-runtime\campaign046-final.db`  
**Schema:** user version `12`  
**Runtime:** `com.braintraining.app` on `emulator-5554`

## Integrity and counts

| Check | Result |
| --- | --- |
| `PRAGMA integrity_check` | `ok` |
| `PRAGMA foreign_key_check` | 0 rows |
| `game_sessions` | 44 |
| Distinct completed `game_id` values | 42 |
| Expected roster missing | `[]` |
| Unexpected game IDs | `[]` |
| `currency_ledger` | 44 |
| `rating_history` | 87 |
| `domain_ratings` | 8 |
| `profile` | 1 |
| `quests` / `quest_progress` | 16 / 9 |
| `achievements` / `achievement_unlocks` | 37 / 9 |
| `tutorial_state` | 16 |
| `workout_instances` | 1 |
| `xp_awards` | 0 (intentional; gameplay XP is represented by session rewards) |

## Invariant checks

The audit reported all of the following clean:

- no duplicate session IDs;
- no duplicate rating natural keys `(session_id, domain)`;
- no duplicate non-null currency operation IDs;
- no orphan currency or rating rows;
- no completed session missing a gameplay reward;
- no zero-XP completed sessions outside the intentional schema design;
- every `raw_result_json` and `difficulty_json` value parsed as an object;
- every normalized result was finite and within `[0, 1]`; and
- completed timestamps were not earlier than started timestamps and durations
  were non-negative.

The version audit compared each persisted session with the generated game
metadata using the actual fields `gameVersion` and `generatorVersion` from the
game definitions. It found `versionMismatches=[]`. An earlier exploratory
query used the unrelated `meta.version` field; that query was discarded and is
not evidence of stale game metadata.

## Backup/restore follow-up

The on-device Data Management flow exported
`brain-training-backup_2026-09-18_19-39-25.json`. The loaded backup manifest
reported schema 12, 272 total records, 44 sessions, 44 ledger entries, and 87
rating-history rows. Merge preview was **Valid** and would add 0 sessions and 0
ledger entries. Replace preview was **Valid** and remained unapplied because it
is destructive. A fresh database pull after both previews retained the counts
above and still passed integrity and foreign-key checks.
