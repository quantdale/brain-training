# Audit Map — Campaign 047

| Area | Evidence | Required check |
| --- | --- | --- |
| Fresh/v12 initialization | migration and integrity test output | current schema, integrity, foreign-key, and startup checks |
| Historical migrations | `src/db/__tests__/migration-*.test.ts` | supported fixtures through v12, rollback, and corruption handling |
| Portability | `src/data-portability/` tests and device Data Management screenshots | export/load, merge/replace preview, duplicate replay, and idempotency |
| Durable identity | session/workout/settings/profile/reward focused suites | stable IDs, unique operations, and no orphan/duplicate rows |
| Relaunch/reliability | release cold-start sample and filtered app logcat | repeated force-stop/relaunch without app fatal/ANR/SQLite/lock/OOM markers |
| Destructive boundary | disposable/import classification | never apply Replace Import to retained evidence without a disposable target |
