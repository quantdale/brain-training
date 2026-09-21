# Campaign 067 — SQLite audit

Pulled from the certified artifact's device after the completion journey
and relaunch (`/data/data/com.braintraining.app/files/SQLite/brain-training.db`).

| Check | Result |
|---|---|
| `PRAGMA integrity_check` | **ok** |
| `PRAGMA user_version` | **12** (current schema) |
| `PRAGMA foreign_key_check` | **0 rows** |
| duplicate `(session_id, domain)` rating rows | **0** |
| `game_sessions` | 1 row (weak completion retained) |
| `currency_ledger` | 1 row (+2 gameplay) |
| `rating_history` | 2 rows (Speed, Attention) |
| `domain_ratings` | 2 rows (986 / 993) |
| `quests` / `achievements` | 16 / 37 (seeded catalogs intact) |
| `profile` | 1 row, fingerprint present |

The 065 transaction-FK fix is exercised by these writes (session
completion runs inside `db.transaction`), and the audit shows no FK
violations; the adapter contract test pins the `PRAGMA foreign_keys = ON`
→ `BEGIN` order on the transaction connection.
