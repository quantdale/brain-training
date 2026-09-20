# Campaign 063 — SQLite Audit (pulled device DB post-completion)

Source: `/data/data/com.braintraining.app/files/SQLite/brain-training.db`
(pulled via root adb; release is non-debuggable so no `run-as`).
Raw DB outside Git (`D:\Temp\c63-bt.db`).

- `PRAGMA integrity_check` → `ok`.
- `user_version` → 12.
- `game_sessions`: 1 row — `speed-tap-rush-*`, normalized `0.0`, xp `10`.
- `currency_ledger`: 1 row — `+2 gameplay` with stable
  `operation_id = 'gameplay:<session>'`.
- `domain_ratings`: `Speed 986 ×1`, `Attention 993 ×1` (weak play costs
  rating; secondary at half weight — pipeline math live on device).
- `rating_history`: 2 rows (`-14` Speed, `-7` Attention).
- Duplicate session ids: **0**. Duplicate non-null operation ids: **0**.
- `PRAGMA foreign_key_check`: **0 violations**.
