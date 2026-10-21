# Backup/restore + migration qualification — Campaign 080 continuation

Date: 2026-10-21
Status: **NOT EXECUTED this continuation — recorded honestly.** Device time
was consumed by the mandatory certification-system repair and the 42-game
revalidation sweep (the primary directive). No data was placed at risk: no
export/import/migration operation was performed against the owner profile.

Prepared this continuation (source-verified surface): the app exposes a full
data-management instrument (`apps/mobile/src/app/data-management.tsx`):
`data-export-card`, import/validation UI, `data-counts-*` per-table counters
(sessions/ratings/history/ledger/favorites/quests/xp) — which is exactly the
authoritative row-count evidence the round-trip protocol needs
(export → row counts + artifact hash → import → counts identical →
invalid-backup rejection → interrupted-import recovery).

Exact next action (isolated fixture, never the owner profile): create a
synthetic profile via the development fixture path, run export → verify
counts/hash → import → verify identical counts → corrupt-file rejection →
interrupted-import recovery; then upgrade/migration: install the prior
compatible build, create known state, upgrade in place, verify schema
migration + progression integrity. Migration fixture must be explicitly
labelled if no authentic prior artifact exists (none is claimed here).
